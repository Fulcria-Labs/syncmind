import { useQuery } from '@powersync/react';

interface TagCloudProps {
  onTagClick?: (tag: string) => void;
}

export function TagCloud({ onTagClick }: TagCloudProps) {
  const { data: notes } = useQuery<{ ai_tags: string }>(
    `SELECT ai_tags FROM notes WHERE ai_tags IS NOT NULL AND ai_tags != ''`
  );

  const tagCounts = new Map<string, number>();
  for (const note of notes) {
    const tags = (note.ai_tags || '').split(',').map(t => t.trim()).filter(Boolean);
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;

  const maxCount = sorted[0][1];

  return (
    <div className="tag-cloud">
      <h3>Topics</h3>
      <div className="tag-cloud-items">
        {sorted.map(([tag, count]) => {
          const scale = 0.7 + (count / maxCount) * 0.6;
          return (
            <button
              key={tag}
              className="tag-cloud-item"
              style={{ fontSize: `${scale}rem` }}
              onClick={() => onTagClick?.(tag)}
              title={`${count} note${count > 1 ? 's' : ''}`}
            >
              {tag}
              <span className="tag-cloud-count">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
