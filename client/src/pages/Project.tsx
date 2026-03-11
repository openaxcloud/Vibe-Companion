import { useState, useEffect } from "react";
import { useParams } from "wouter";

export default function Project() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log("[Project] mounted with id:", projectId);
  }, [projectId]);

  return (
    <div className="h-screen flex items-center justify-center bg-[#0E1525] text-white" data-testid="project-minimal">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Project: {projectId || "NO ID"}</h1>
        <p className="mb-4">Count: {count}</p>
        <button
          onClick={() => setCount(c => c + 1)}
          className="px-4 py-2 bg-[#0079F2] rounded"
          data-testid="button-increment"
        >
          Increment
        </button>
      </div>
    </div>
  );
}
