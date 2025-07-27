/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{html,js,ts,jsx,tsx}",
  ],
  safelist: [
    {
      pattern:
        /(bg|border)-(orange-(300|400|500|600|700|800)|sky-(600|700)|red-700)\/(10|20|30|40|50|60|70|80|90)/
    },
    {
      pattern:
        /(bg|border)-(orange-(300|400|500|600|700|800)|sky-(600|700)|red-700)/
    },
    'bg-slate-700/30',
    'bg-slate-600',
    'hover:bg-slate-700',
    'border-[#475569]',
    'bg-[rgba(30,41,59,0.4)]',
    'text-gray-500/60',
  ],
  theme: { extend: {} },
  plugins: [],
};