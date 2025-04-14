// app/projects/wise-academy/loading.tsx
export default function Loading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="spinner-border animate-spin inline-block w-8 h-8 border-4 rounded-full border-[#90dda9]" role="status"></div>
    </div>
  );
}