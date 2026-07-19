export function DoneButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-black transition hover:bg-white/90"
    >
      done
    </button>
  );
}
