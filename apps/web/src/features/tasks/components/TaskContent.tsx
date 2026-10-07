import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ProjectLabel, Task } from "@vexa/domain/types";
import "./task-content.css";

import { labelInk } from "@/lib/label-color";
import { CommentThread } from "@/features/comments/components/CommentThread";

export function TaskLabels({ labels = [] }: { labels?: ProjectLabel[] }) {
  if (!labels.length) return null;
  return (
    <div className="task-labels">
      {labels.map((label) => (
        <span
          key={label.id}
          className="task-label"
          style={{ backgroundColor: label.color, color: labelInk(label.color) }}
        >
          {label.name}
        </span>
      ))}
    </div>
  );
}
export function TaskMarkdown({ text }: { text: string }) {
  return (
    <div className="task-markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: () => null,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
export function TaskContent({ task }: { task: Task }) {
  return (
    <div className="grid gap-4">
      <TaskLabels labels={task.labels} />
      <section className="grid gap-2">
        <h4 className="text-sm font-semibold">Descripción</h4>
        {task.description?.trim() ? (
          <TaskMarkdown text={task.description} />
        ) : (
          <p className="text-sm text-muted">Sin descripción.</p>
        )}
      </section>
      <CommentThread entity="task" entityId={task.id} />
    </div>
  );
}
