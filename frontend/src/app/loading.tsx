import { LoadingState } from "@/components/shared/request-states";

export default function Loading() {
  return (
    <div className="p-8">
      <LoadingState />
    </div>
  );
}
