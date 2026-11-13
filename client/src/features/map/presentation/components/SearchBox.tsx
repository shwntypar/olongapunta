import { CloseIcon, SearchIcon } from "./icons";

/** The "Search places or categories..." box over the map. */
export default function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="bg-white rounded-full shadow-md px-4 py-2 flex items-center flex-1 min-w-0 sm:flex-none sm:w-64 md:w-80">
      <SearchIcon className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
      <input
        type="text"
        placeholder="Search places or categories..."
        className="w-full text-sm outline-none bg-transparent text-gray-700"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button onClick={() => onChange("")} className="text-gray-400 hover:text-gray-600 ml-2 focus:outline-none">
          <CloseIcon className="w-4 h-4" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
