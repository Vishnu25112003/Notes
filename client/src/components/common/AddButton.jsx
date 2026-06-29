export default function AddButton({ onClick, label = 'New' }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-5 py-3 rounded-full shadow-lg shadow-violet-900/40 transition-all active:scale-95 text-sm"
    >
      <span className="text-lg leading-none">+</span>
      {label}
    </button>
  );
}
