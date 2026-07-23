export default function Loading() {
  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-12 animate-pulse">
      <div className="h-8 bg-[#F5EDD6] rounded w-64 mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] bg-[#F5EDD6] rounded" />
        ))}
      </div>
    </div>
  );
}