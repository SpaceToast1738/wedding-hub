"use client";

import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useState } from "react";
import { sanitizeBookHtml } from "@/lib/sanitize-book-html";

// v1.37.2: Tailwind v4 in this project doesn't ship `@tailwindcss/
// typography`, so the Tiptap default `prose` class has no styles to
// hang on to — `<ul>`, `<ol>`, `<blockquote>` all render with
// list-style:none + zero margins (Preflight reset) and the bullet /
// number markers disappear. We explicitly pin the styles for every
// tag the sanitiser allows. Shared between the editor (edit mode)
// and `RichTextRead` (view mode) so what-you-see-is-what-you-get
// across the toggle.
const RICH_TEXT_PROSE_CLASS = [
  "max-w-none text-sm text-ink-secondary leading-relaxed",
  // Block spacing — tight, matches how the editor authors paragraph
  // breaks via blank lines.
  "[&>:first-child]:mt-0 [&>:last-child]:mb-0",
  "[&_p]:my-2",
  // Headings.
  "[&_h2]:text-ink-primary [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5",
  "[&_h3]:text-ink-primary [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1",
  // Lists — explicit list-style + indentation since Preflight kills
  // the browser defaults.
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2",
  "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2",
  "[&_li]:my-0.5 [&_li]:pl-1",
  // Nested lists collapse the outer margin so the indent reads
  // cleanly when someone makes a bulleted sub-list.
  "[&_li>ul]:my-1 [&_li>ol]:my-1",
  // Blockquote — left border + muted text, matches how it reads in
  // every other Wedding Book card.
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border-soft [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-ink-tertiary [&_blockquote]:my-2",
  // Inline marks.
  "[&_strong]:font-semibold [&_strong]:text-ink-primary",
  "[&_em]:italic",
  "[&_u]:underline",
  "[&_a]:text-info [&_a]:underline",
].join(" ");

// v1.37.0 (P7a): Tiptap-based WYSIWYG for the Book TEXT card. The
// toolbar is a **compile-time constant** — Bold, Italic, Underline,
// H2, H3, Bullet list, Numbered list, Blockquote, Link, Undo, Redo.
// Nothing else. The Book Expansion Plan §5 deliberately scopes this
// to ten marks; this is not the start of a slippery slope towards
// blocks / embeds / slash menus / colour pickers / etc.
//
// Output: HTML string. Always sanitised on the server before write
// (and on the way out for read), so even if a paste somehow gets
// disallowed marks past the editor, the database stays clean.
//
// Mobile collapse: < 640px shows a 5-button toolbar (Bold, Italic,
// Bullet list, Link, More) with a "more" sheet revealing the rest.

type RichTextEditorProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder,
}: RichTextEditorProps) {
  const editor = useEditor({
    // SSR safe — disable immediately rendering the prose-mirror DOM.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // We use the dedicated Link extension (configurable) instead
        // of StarterKit's default to enforce target="_blank" + rel.
        link: false,
        // Heading is on, but we restrict it to H2 + H3 only.
        heading: { levels: [2, 3] },
        // No code blocks / code marks — they'd require sanitiser
        // changes and aren't on the toolbar.
        codeBlock: false,
        code: false,
        // No horizontal rule — also off the toolbar.
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        // Tiptap's link extension auto-recognises pasted URLs but we
        // route through the dialog button to keep behaviour explicit.
        openOnClick: false,
        // Force every link to look how the sanitiser will rewrite it
        // — keeps the editor preview accurate.
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: `min-h-[120px] px-2 py-1.5 outline-none ${RICH_TEXT_PROSE_CLASS}`,
      },
    },
    content: value || "",
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editable: !disabled,
  });

  // Sync external value changes (cancel / re-load) without losing
  // cursor on every keystroke. We only push the prop into the editor
  // when it actually differs from the current HTML.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  // Mirror the disabled prop onto the editor's editable state.
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) {
    return (
      <div className="bg-canvas/50 border border-border-soft rounded-sm min-h-[140px] animate-pulse" />
    );
  }

  return (
    <div className="border border-border-soft rounded-sm bg-surface focus-within:border-moss-500">
      <Toolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  );
}

// ── Toolbar ────────────────────────────────────────────────────────

const PRIMARY_TOOLBAR = ["bold", "italic", "bulletList", "link", "more"] as const;

type ToolButtonId =
  | "bold"
  | "italic"
  | "underline"
  | "h2"
  | "h3"
  | "bulletList"
  | "orderedList"
  | "blockquote"
  | "link"
  | "undo"
  | "redo";

function Toolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const [moreOpen, setMoreOpen] = useState(false);

  const buttons: Record<ToolButtonId, ToolButton> = {
    bold: {
      label: "B",
      title: "Bold",
      isActive: () => editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
      className: "font-bold",
    },
    italic: {
      label: "I",
      title: "Italic",
      isActive: () => editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
      className: "italic",
    },
    underline: {
      label: "U",
      title: "Underline",
      isActive: () => editor.isActive("underline"),
      run: () => editor.chain().focus().toggleUnderline().run(),
      className: "underline",
    },
    h2: {
      label: "H2",
      title: "Heading 2",
      isActive: () => editor.isActive("heading", { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    h3: {
      label: "H3",
      title: "Heading 3",
      isActive: () => editor.isActive("heading", { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    bulletList: {
      label: "•",
      title: "Bullet list",
      isActive: () => editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    orderedList: {
      label: "1.",
      title: "Numbered list",
      isActive: () => editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    blockquote: {
      label: "❝",
      title: "Blockquote",
      isActive: () => editor.isActive("blockquote"),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    link: {
      label: "🔗",
      title: "Link",
      isActive: () => editor.isActive("link"),
      run: () => promptForLink(editor),
    },
    undo: {
      label: "↶",
      title: "Undo",
      isActive: () => false,
      run: () => editor.chain().focus().undo().run(),
      isDisabled: () => !editor.can().undo(),
    },
    redo: {
      label: "↷",
      title: "Redo",
      isActive: () => false,
      run: () => editor.chain().focus().redo().run(),
      isDisabled: () => !editor.can().redo(),
    },
  };

  const desktopOrder: ToolButtonId[] = [
    "bold",
    "italic",
    "underline",
    "h2",
    "h3",
    "bulletList",
    "orderedList",
    "blockquote",
    "link",
    "undo",
    "redo",
  ];
  const moreSheet: ToolButtonId[] = [
    "underline",
    "h2",
    "h3",
    "orderedList",
    "blockquote",
    "undo",
    "redo",
  ];

  return (
    <div className="border-b border-border-soft bg-canvas/40 px-1 py-0.5 relative">
      {/* Desktop ≥ sm */}
      <div className="hidden sm:flex items-center gap-0.5 flex-wrap">
        {desktopOrder.map((id) => (
          <ToolButtonView
            key={id}
            id={id}
            button={buttons[id]}
            disabled={disabled}
          />
        ))}
      </div>
      {/* Mobile < sm */}
      <div className="flex sm:hidden items-center gap-0.5">
        {PRIMARY_TOOLBAR.map((id) =>
          id === "more" ? (
            <button
              key="more"
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              disabled={disabled}
              className="text-[11px] text-ink-tertiary hover:text-ink-primary px-2 py-1"
              aria-label="More formatting options"
            >
              ⋯
            </button>
          ) : (
            <ToolButtonView
              key={id}
              id={id}
              button={buttons[id]}
              disabled={disabled}
            />
          ),
        )}
      </div>
      {/* Mobile "more" sheet */}
      {moreOpen && (
        <div className="sm:hidden absolute z-10 right-0 top-full mt-0.5 bg-surface border border-border-soft rounded-sm shadow-md flex items-center gap-0.5 p-1">
          {moreSheet.map((id) => (
            <ToolButtonView
              key={`more-${id}`}
              id={id}
              button={buttons[id]}
              disabled={disabled}
              onAfter={() => setMoreOpen(false)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type ToolButton = {
  label: string;
  title: string;
  isActive: () => boolean;
  run: () => void;
  className?: string;
  isDisabled?: () => boolean;
};

function ToolButtonView({
  id,
  button,
  disabled,
  onAfter,
}: {
  id: ToolButtonId;
  button: ToolButton;
  disabled: boolean;
  onAfter?: () => void;
}) {
  const active = button.isActive();
  const buttonDisabled = disabled || (button.isDisabled?.() ?? false);
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault() /* keep selection */}
      onClick={() => {
        button.run();
        onAfter?.();
      }}
      disabled={buttonDisabled}
      title={button.title}
      aria-label={button.title}
      aria-pressed={active}
      data-tool={id}
      className={[
        "min-w-7 h-7 px-1.5 text-xs rounded-sm border",
        active
          ? "bg-moss-50 border-moss-300 text-moss-700"
          : "bg-transparent border-transparent text-ink-secondary hover:bg-canvas hover:text-ink-primary",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        button.className ?? "",
      ].join(" ")}
    >
      {button.label}
    </button>
  );
}

function promptForLink(editor: Editor) {
  // Native prompt for now — keeps the editor footprint tiny and the
  // user's mental model identical to every other link picker on the
  // app. If we add a richer modal later, sanitise still owns the
  // truth on the server side.
  const previous = editor.getAttributes("link").href as string | undefined;
  const href = window.prompt("URL (https:// …)", previous ?? "");
  if (href === null) return; // cancelled
  if (href.trim() === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor
    .chain()
    .focus()
    .extendMarkRange("link")
    .setLink({ href: href.trim() })
    .run();
}

// ── Read-mode component ────────────────────────────────────────────
//
// For non-editing contexts (and the legacy fallback when bodyHtml is
// null but body isn't), we use a memoised dangerouslySetInnerHTML
// wrapper that passes the HTML through the same sanitiser as a
// belt-and-braces guard. Caller pre-sanitises too (server-side on
// write); double-sanitising is cheap and idempotent.

export function RichTextRead({ html, className }: { html: string; className?: string }) {
  const sanitised = useMemo(() => sanitizeBookHtml(html), [html]);
  return (
    <div
      className={[RICH_TEXT_PROSE_CLASS, className ?? ""].join(" ")}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: sanitised }}
    />
  );
}
