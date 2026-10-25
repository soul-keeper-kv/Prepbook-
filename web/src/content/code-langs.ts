// Languages of the template code. Shiki loads a grammar for each one (lib/highlight.ts).

export const CODE_LANG_LABEL: Record<string, string> = {
  python: "Python",
  java: "Java",
  cpp: "C++",
  javascript: "JavaScript",
  go: "Go",
}

interface CodeFile {
  name: string
  icon: string
  /** Colour of the language icon in VS Code's Seti icon theme */
  iconClass: string
}

// Each language is shown as a file tab, like VS Code: file name plus a coloured icon.
// Class names are written out in full so Tailwind finds them.
const CODE_FILES: Record<string, CodeFile> = {
  python: { name: "solution.py", icon: "py", iconClass: "text-[#519aba]" },
  java: { name: "Solution.java", icon: "J", iconClass: "text-[#cc3e44]" },
  cpp: { name: "solution.cpp", icon: "C++", iconClass: "text-[#a074c4]" },
  javascript: { name: "solution.js", icon: "JS", iconClass: "text-[#cbcb41]" },
  go: { name: "solution.go", icon: "GO", iconClass: "text-[#519aba]" },
}

export const codeFile = (lang: string): CodeFile =>
  CODE_FILES[lang] ?? { name: `solution.${lang}`, icon: "{}", iconClass: "text-muted-foreground" }

export const codeLangLabel = (lang: string) => CODE_LANG_LABEL[lang] ?? lang
