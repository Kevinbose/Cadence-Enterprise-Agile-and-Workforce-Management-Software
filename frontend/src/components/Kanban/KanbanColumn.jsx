import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import KanbanCard from './KanbanCard';

// ─── Column-specific light glassmorphic styles and drop zones ──────────────────
const COLUMN_STYLES = {
  TODO: {
    bg: 'bg-gradient-to-b from-slate-500/[0.015] to-slate-500/[0.035]',
    dragOver: 'bg-slate-500/[0.08] ring-2 ring-inset ring-slate-400/20',
    frozenNonTodo: false,
  },
  IN_PROGRESS: {
    bg: 'bg-gradient-to-b from-[#0A89CD]/[0.015] to-[#0A89CD]/[0.045]',
    dragOver: 'bg-[#0A89CD]/[0.08] ring-2 ring-inset ring-[#0A89CD]/30',
    frozenNonTodo: true,
  },
  IN_REVIEW: {
    bg: 'bg-gradient-to-b from-[#5243AA]/[0.015] to-[#5243AA]/[0.045]',
    dragOver: 'bg-[#5243AA]/[0.08] ring-2 ring-inset ring-[#5243AA]/30',
    frozenNonTodo: true,
  },
  QA_TESTING: {
    bg: 'bg-gradient-to-b from-amber-500/[0.01] to-amber-500/[0.035]',
    dragOver: 'bg-amber-500/[0.08] ring-2 ring-inset ring-amber-500/30',
    frozenNonTodo: true,
  },
  DONE: {
    bg: 'bg-gradient-to-b from-emerald-500/[0.015] to-emerald-500/[0.045]',
    dragOver: 'bg-emerald-500/[0.08] ring-2 ring-inset ring-emerald-500/30',
    frozenNonTodo: true,
  },
};

/**
 * KanbanColumn — renders the cards for a single status within one swimlane cell.
 *
 * Props:
 *   columnKey   — the status key (e.g. 'TODO', 'IN_PROGRESS')
 *   tasks       — array of tasks belonging to this column
 *   currentUser — the logged-in user
 *   isElevated  — current user is SM or Manager
 *   isFrozen    — sprint is PENDING or COMPLETED; all card movement is locked
 *   isArchived  — sprint is COMPLETED; suppresses per-column dimming (uniform read-only look)
 *   onAdvance   — (task, nextStatus) => void
 *   onReview    — (task, mode) => void
 *   onEdit      — (task) => void
 *   onDelete    — (task) => void
 *   laneKey     — unique lane identifier for composing droppableId
 */
const KanbanColumn = ({
  columnKey,
  tasks,
  currentUser,
  isElevated,
  isFrozen,
  isArchived,
  onAdvance,
  onReview,
  onEdit,
  onDelete,
  laneKey,
}) => {
  const droppableId = `${laneKey}::${columnKey}`;
  const style = COLUMN_STYLES[columnKey] || COLUMN_STYLES.TODO;

  // When the sprint is PENDING, non-TODO columns get a subtle locked overlay to
  // signal that cards cannot be dropped there. For COMPLETED (archived) sprints
  // we intentionally skip dimming — the entire board is a uniform read-only view
  // and we don't want some columns to look "more accessible" than others.
  const isFrozenColumn = isFrozen && style.frozenNonTodo && !isArchived;

  return (
    <Droppable droppableId={droppableId} isDropDisabled={isFrozenColumn}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`
            flex flex-col gap-2.5 min-h-[140px] h-full p-2.5 transition-all duration-200
            ${snapshot.isDraggingOver ? style.dragOver : style.bg}
            ${isFrozenColumn ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {tasks.length === 0 && !snapshot.isDraggingOver ? (
            <div className="flex flex-1 items-center justify-center py-6 opacity-40">
              <span className="text-[10px] font-bold text-[#C1C7D0]/60 uppercase tracking-widest">—</span>
            </div>
          ) : null}
          {tasks.map((task, index) => (
            <Draggable
              key={task.id}
              draggableId={String(task.id)}
              index={index}
              isDragDisabled={isFrozen}
            >
              {(dragProvided, dragSnapshot) => (
                <div
                  ref={dragProvided.innerRef}
                  {...dragProvided.draggableProps}
                  {...dragProvided.dragHandleProps}
                >
                  <KanbanCard
                    task={task}
                    isOwner={currentUser && task.assigneeId === currentUser.id}
                    isElevated={isElevated}
                    isFrozen={isFrozen}
                    isArchived={isArchived}
                    onAdvance={onAdvance}
                    onReview={onReview}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    currentUser={currentUser}
                    isDragging={dragSnapshot.isDragging}
                  />
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
};

export default KanbanColumn;
