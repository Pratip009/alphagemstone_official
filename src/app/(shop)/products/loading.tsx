export default function Loading() {
  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="w-full aspect-square bg-[#F5EDD6] rounded" />
            <div className="h-3 bg-[#F5EDD6] rounded w-3/4 mt-3" />
            <div className="h-3 bg-[#F5EDD6] rounded w-1/3 mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}