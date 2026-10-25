package dev.kienpt.dsaroadmap;

import android.app.Activity;
import android.app.PendingIntent;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Gives the web app an access token for the Google Drive REST API, which main.js then
 * calls with fetch(). Google blocks its sign-in page inside a WebView, so the Android
 * app signs in through Google Play services instead (AuthorizationClient).
 *
 * The app is matched to the "Android" OAuth client in Google Cloud by package name and
 * signing-certificate SHA-1, so no client ID is needed in code. See README.md at the repository root.
 *
 * JS: Capacitor.Plugins.GoogleDrive
 *   getAccessToken({ interactive }) -> { accessToken }
 *     interactive=false rejects with code NEED_CONSENT instead of showing Google's screens
 *   clearToken({ token })  drops a token Drive rejected (401), so the next call gets a fresh one
 */
@CapacitorPlugin(name = "GoogleDrive")
public class GoogleDrivePlugin extends Plugin {

    // Only files this app created; the user's other Drive files stay out of reach.
    private static final Scope DRIVE_FILE = new Scope("https://www.googleapis.com/auth/drive.file");

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private ActivityResultLauncher<IntentSenderRequest> consentLauncher;
    private PluginCall consentCall;

    @Override
    public void load() {
        // Must be registered before the activity starts; plugins load during onCreate.
        consentLauncher = getActivity().registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(),
            this::onConsentResult
        );
    }

    @PluginMethod
    public void getAccessToken(PluginCall call) {
        boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", false));
        AuthorizationRequest request = AuthorizationRequest.builder().setRequestedScopes(List.of(DRIVE_FILE)).build();

        Identity.getAuthorizationClient(getActivity())
            .authorize(request)
            .addOnSuccessListener(result -> {
                if (!result.hasResolution()) {
                    resolveToken(call, result);
                } else if (!interactive) {
                    call.reject("Google Drive access has not been granted yet", "NEED_CONSENT");
                } else if (consentCall != null) {
                    call.reject("Google sign-in is already open", "BUSY");
                } else {
                    // Account picker + consent screen, shown by Google Play services
                    consentCall = call;
                    PendingIntent intent = result.getPendingIntent();
                    consentLauncher.launch(new IntentSenderRequest.Builder(intent.getIntentSender()).build());
                }
            })
            .addOnFailureListener(e -> call.reject(e.getMessage(), "AUTH_FAILED", e));
    }

    private void onConsentResult(ActivityResult activityResult) {
        PluginCall call = consentCall;
        consentCall = null;
        if (call == null) return;
        if (activityResult.getResultCode() != Activity.RESULT_OK) {
            call.reject("Google sign-in was cancelled", "CANCELLED");
            return;
        }
        try {
            AuthorizationResult result = Identity.getAuthorizationClient(getActivity())
                .getAuthorizationResultFromIntent(activityResult.getData());
            resolveToken(call, result);
        } catch (ApiException e) {
            call.reject(e.getMessage(), "AUTH_FAILED", e);
        }
    }

    private void resolveToken(PluginCall call, AuthorizationResult result) {
        String token = result.getAccessToken();
        if (token == null) {
            call.reject("Google returned no access token", "AUTH_FAILED");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("accessToken", token);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearToken(PluginCall call) {
        String token = call.getString("token");
        if (token == null) {
            call.resolve();
            return;
        }
        // clearToken blocks on Play services, so it must not run on the main thread
        executor.execute(() -> {
            try {
                GoogleAuthUtil.clearToken(getContext(), token);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage(), "CLEAR_FAILED", e);
            }
        });
    }
}
