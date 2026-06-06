'use client';
import BlogEditor from '../BlogEditor';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewBlogPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/blogs" className="flex items-center gap-1.5 text-[0.7rem] text-[#a09a90] hover:text-[#c9a84c] transition-colors">
          <ArrowLeft size={13} strokeWidth={2} /> Back
        </Link>
        <span className="text-[#d4cfc8]">/</span>
        <span className="text-[0.7rem] font-semibold text-[#1a1714]">New Post</span>
      </div>
      <div className="mb-6">
        <p className="text-[0.68rem] tracking-[0.22em] uppercase text-[#c9a84c] font-semibold mb-2">◆ Content Management</p>
        <h1 className="font-['Cormorant_Garamond',serif] text-[2.4rem] font-medium text-[#1a1714] leading-none">Create New Post</h1>
      </div>
      <div className="mb-6 h-px bg-gradient-to-r from-[#c9a84c]/30 via-[#ede9e1] to-transparent" />
      <BlogEditor />
    </div>
  );
}