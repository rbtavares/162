import { AUTHOR_NAME, AUTHOR_URL, REPO_URL, TITLE_SEPARATOR } from "@/data/site";

/** "Made by … · Source on GitHub", for the gallery and sidebar footers. */
export function Credits({ className }: { className?: string }) {
  return (
    <p className={className}>
      Made by{" "}
      <a href={AUTHOR_URL} className="text-zinc-300 hover:text-white">
        {AUTHOR_NAME}
      </a>
      {TITLE_SEPARATOR}
      <a href={REPO_URL} className="text-zinc-300 hover:text-white">
        Source on GitHub
      </a>
    </p>
  );
}
