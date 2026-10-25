package dev.kienpt.dsaroadmap;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins written inside the app (not installed from npm) must be registered by hand
        registerPlugin(GoogleDrivePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
