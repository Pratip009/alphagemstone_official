'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import {TextStyle} from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {Table} from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import { useCallback, useRef } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Code2,
  Heading1, Heading2, Heading3, List, ListOrdered, ListChecks,
  Quote, Minus, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Highlighter, Link2, ImageIcon, Table as TableIcon,
  Undo, Redo, Palette, Type,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onImageUpload?: (file: File) => Promise<string>;
  error?: boolean;
}

// ─── Toolbar Button ───────────────────────────────────────────────────────────

function ToolBtn({
  onClick, active, title, children, disabled,
}: {
  onClick: () => void;
  active?: boolean;
  title?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      disabled={disabled}
      className={`w-7 h-7 flex items-center justify-center rounded transition-all text-[0.7rem] shrink-0 ${
        active
          ? 'bg-[#c9a84c]/20 text-[#8a6e2a] border border-[#c9a84c]/40'
          : 'text-[#6b6560] hover:bg-[#f5f3ef] hover:text-[#1a1714] border border-transparent'
      } disabled:opacity-30`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-[#ede9e1] mx-0.5 shrink-0" />;
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your article here…',
  onImageUpload,
  error = false,
}: RichTextEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: { languageClassPrefix: 'language-' },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'editor-link' } }),
      Image.configure({ HTMLAttributes: { class: 'editor-img' } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'tiptap-editor focus:outline-none',
      },
    },
    immediatelyRender: false,
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL', prev || 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const insertImage = useCallback(async (file: File) => {
    if (!editor || !onImageUpload) return;
    const url = await onImageUpload(file);
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor, onImageUpload]);

  const insertImageFromUrl = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Image URL');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={`border rounded-xl overflow-hidden bg-white transition-all ${
      error
        ? 'border-red-300'
        : 'border-[#ede9e1] focus-within:border-[#c9a84c]/60 focus-within:ring-1 focus-within:ring-[#c9a84c]/20'
    }`}>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-[#ede9e1] bg-[#faf9f7]">

        {/* History */}
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo (⌘Z)" disabled={!editor.can().undo()}>
          <Undo size={13} strokeWidth={2} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo (⌘⇧Z)" disabled={!editor.can().redo()}>
          <Redo size={13} strokeWidth={2} />
        </ToolBtn>

        <Divider />

        {/* Headings */}
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <span className="font-bold text-[0.65rem] leading-none">H1</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <span className="font-bold text-[0.65rem] leading-none">H2</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <span className="font-bold text-[0.65rem] leading-none">H3</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Paragraph">
          <Type size={13} strokeWidth={2} />
        </ToolBtn>

        <Divider />

        {/* Marks */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (⌘B)">
          <Bold size={13} strokeWidth={2.5} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (⌘I)">
          <Italic size={13} strokeWidth={2} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (⌘U)">
          <UnderlineIcon size={13} strokeWidth={2} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough size={13} strokeWidth={2} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">
          <Code size={13} strokeWidth={2} />
        </ToolBtn>

        <Divider />

        {/* Color */}
        <label title="Text color" className="relative w-7 h-7 flex items-center justify-center rounded text-[#6b6560] hover:bg-[#f5f3ef] cursor-pointer border border-transparent">
          <Palette size={13} strokeWidth={2} />
          <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            onChange={e => editor.chain().focus().setColor(e.target.value).run()} />
        </label>
        <label title="Highlight" className="relative w-7 h-7 flex items-center justify-center rounded text-[#6b6560] hover:bg-[#f5f3ef] cursor-pointer border border-transparent">
          <Highlighter size={13} strokeWidth={2} />
          <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            onChange={e => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()} />
        </label>

        <Divider />

        {/* Alignment */}
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
          <AlignLeft size={13} strokeWidth={2} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
          <AlignCenter size={13} strokeWidth={2} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
          <AlignRight size={13} strokeWidth={2} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
          <AlignJustify size={13} strokeWidth={2} />
        </ToolBtn>

        <Divider />

        {/* Lists */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <List size={13} strokeWidth={2} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered list">
          <ListOrdered size={13} strokeWidth={2} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Task list">
          <ListChecks size={13} strokeWidth={2} />
        </ToolBtn>

        <Divider />

        {/* Blocks */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          <Quote size={13} strokeWidth={2} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">
          <Code2 size={13} strokeWidth={2} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
          <Minus size={13} strokeWidth={2} />
        </ToolBtn>

        <Divider />

        {/* Link & Images & Table */}
        <ToolBtn onClick={setLink} active={editor.isActive('link')} title="Insert link">
          <Link2 size={13} strokeWidth={2} />
        </ToolBtn>
        <ToolBtn
          onClick={() => onImageUpload ? fileRef.current?.click() : insertImageFromUrl()}
          title="Insert image"
        >
          <ImageIcon size={13} strokeWidth={2} />
        </ToolBtn>
        <ToolBtn onClick={insertTable} title="Insert table">
          <TableIcon size={13} strokeWidth={2} />
        </ToolBtn>
      </div>


      {/* ── Editor content ── */}
      <EditorContent
        editor={editor}
        className="min-h-[420px] px-5 py-4 text-[0.88rem] leading-relaxed text-[#3c3830]"
      />

      {/* Hidden file input for image upload */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) insertImage(f);
          e.target.value = '';
        }}
      />

      {/* ── Editor styles ── */}
      <style jsx global>{`
        .tiptap-editor > * + * { margin-top: 0.75rem; }

        .tiptap-editor h1 { font-family: 'Cormorant Garamond', serif; font-size: 1.9rem; font-weight: 700; color: #1a1714; line-height: 1.2; }
        .tiptap-editor h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; font-weight: 600; color: #1a1714; border-bottom: 1px solid #ede9e1; padding-bottom: 0.4rem; }
        .tiptap-editor h3 { font-family: 'Cormorant Garamond', serif; font-size: 1.25rem; font-weight: 600; color: #1a1714; }
        .tiptap-editor h4, .tiptap-editor h5, .tiptap-editor h6 { font-weight: 600; color: #1a1714; }

        .tiptap-editor p { color: #3c3830; line-height: 1.8; }
        .tiptap-editor strong { font-weight: 700; color: #1a1714; }
        .tiptap-editor em { font-style: italic; color: #5c5852; }
        .tiptap-editor u { text-decoration: underline; }
        .tiptap-editor s { text-decoration: line-through; }

        .tiptap-editor a.editor-link { color: #c9a84c; text-decoration: underline; cursor: pointer; }

        .tiptap-editor ul { list-style: disc; padding-left: 1.5rem; }
        .tiptap-editor ol { list-style: decimal; padding-left: 1.5rem; }
        .tiptap-editor li { margin-bottom: 0.25rem; color: #3c3830; }

        .tiptap-editor ul[data-type="taskList"] { list-style: none; padding-left: 0; }
        .tiptap-editor ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
        .tiptap-editor ul[data-type="taskList"] li > label { margin-top: 0.1rem; }
        .tiptap-editor ul[data-type="taskList"] li input[type="checkbox"] { accent-color: #c9a84c; margin-top: 2px; }

        .tiptap-editor blockquote {
          border-left: 4px solid #c9a84c;
          padding: 0.7rem 1rem;
          margin: 1rem 0;
          background: #faf9f7;
          border-radius: 0 8px 8px 0;
          font-family: 'Cormorant Garamond', serif;
          font-style: italic;
          color: #5c5852;
          font-size: 1.05rem;
        }

        .tiptap-editor code {
          background: #f5f3ef;
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
          font-size: 0.82em;
          font-family: 'JetBrains Mono', monospace;
          color: #c9a84c;
          border: 1px solid #ede9e1;
        }

        .tiptap-editor pre {
          background: #1a1714;
          color: #e8e0d0;
          padding: 1rem 1.2rem;
          border-radius: 10px;
          overflow-x: auto;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.82rem;
          line-height: 1.6;
        }
        .tiptap-editor pre code {
          background: none;
          border: none;
          padding: 0;
          color: inherit;
          font-size: inherit;
        }

        .tiptap-editor hr {
          border: none;
          height: 1px;
          background: linear-gradient(90deg, transparent, #c9a84c40, transparent);
          margin: 1.5rem 0;
        }

        .tiptap-editor img.editor-img {
          border-radius: 10px;
          max-width: 100%;
          height: auto;
          margin: 0.5rem 0;
        }

        .tiptap-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
          font-size: 0.83rem;
        }
        .tiptap-editor table th {
          background: #f5f3ef;
          font-weight: 600;
          color: #1a1714;
          padding: 0.5rem 0.75rem;
          border: 1px solid #ede9e1;
          text-align: left;
        }
        .tiptap-editor table td {
          padding: 0.5rem 0.75rem;
          border: 1px solid #ede9e1;
          color: #5c5852;
        }
        .tiptap-editor table tr:nth-child(even) td { background: #faf9f7; }

        .tiptap-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #c4bdb2;
          pointer-events: none;
          float: left;
          height: 0;
        }
      `}</style>
    </div>
  );
}