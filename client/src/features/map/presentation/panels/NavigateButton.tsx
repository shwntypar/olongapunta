const SIZES = {
  sm: { button: "p-2 rounded-md shadow-sm", icon: "w-3.5 h-3.5" },
  md: { button: "p-2 rounded-lg shadow-md shadow-blue-600/20", icon: "w-4 h-4" },
  round: { button: "p-2 rounded-full shadow-md shadow-blue-600/20", icon: "w-4 h-4" },
} as const;

/** The blue "get directions" arrow on list rows. Doesn't trigger the row's own click. */
export default function NavigateButton({ onClick, size = "md" }: { onClick: () => void; size?: keyof typeof SIZES }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="Get directions"
      className={`flex-shrink-0 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-colors flex items-center justify-center ${SIZES[size].button}`}
    >
      <svg className={SIZES[size].icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    </button>
  );
}
