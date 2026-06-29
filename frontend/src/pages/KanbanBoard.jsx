import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { DragDropContext } from '@hello-pangea/dnd';
import confetti from 'canvas-confetti';
import {
  Plus,
  RefreshCw,
  LayoutGrid,
  AlertCircle,
  Layers,
  Filter,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Lock,
  Archive,
} from 'lucide-react';
import Layout from '../components/Layout/Layout';
import KanbanColumn from '../components/Kanban/KanbanColumn';
import CreateIssueModal from '../components/Kanban/CreateIssueModal';
import EditIssueModal from '../components/Kanban/EditIssueModal';
import DeleteConfirmationModal from '../components/Kanban/DeleteConfirmationModal';
import ReviewAdjudicationModal from '../components/Kanban/ReviewAdjudicationModal';
import toast from 'react-hot-toast';
import {
  fetchBoard,
  updateStatus,
  toggleMyIssues,
} from '../features/kanban/kanbanSlice';

// ─── Column definitions with accent themes ───────────────────────────────────
const COLUMNS = [
  {
    key: 'TODO',
    label: 'To Do',
    accent: 'bg-slate-50/90 text-slate-600 ring-1 ring-slate-200/60',
    dotColor: 'bg-slate-400',
    dropBg: 'from-slate-500/5',
  },
  {
    key: 'IN_PROGRESS',
    label: 'In Progress',
    accent: 'bg-blue-50/90 text-blue-700 ring-1 ring-blue-200/60',
    dotColor: 'bg-blue-500',
    dropBg: 'from-blue-500/5',
  },
  {
    key: 'IN_REVIEW',
    label: 'In Review',
    accent: 'bg-purple-50/90 text-purple-700 ring-1 ring-purple-200/60',
    dotColor: 'bg-purple-500',
    dropBg: 'from-purple-500/5',
  },
  {
    key: 'QA_TESTING',
    label: 'QA / Testing',
    accent: 'bg-amber-50/90 text-amber-700 ring-1 ring-amber-200/60',
    dotColor: 'bg-amber-500',
    dropBg: 'from-amber-500/5',
  },
  {
    key: 'DONE',
    label: 'Done',
    accent: 'bg-emerald-50/90 text-emerald-700 ring-1 ring-emerald-200/60',
    dotColor: 'bg-emerald-500',
    dropBg: 'from-emerald-500/5',
  },
];

const TYPE_LOZENGE = {
  Epic: 'bg-[#EAE6FF] text-[#5243AA]',
  Story: 'bg-[#E3FCEF] text-[#006644]',
  Task: 'bg-[#DEEBFF] text-[#0747A6]',
  Subtask: 'bg-[#DFE1E6] text-[#42526E]',
};

const TYPE_DOT = {
  Epic: 'bg-[#5243AA]',
  Story: 'bg-[#006644]',
  Task: 'bg-[#0747A6]',
  Subtask: 'bg-[#42526E]',
};

// ─── Professional multi-stage celebration animation ──────────────────────────
const fireCelebration = () => {
  const brandColors = ['#36A15D', '#0A89CD', '#5243AA', '#FFD700', '#FFFFFF'];

  // Stage 1: Twin side-cannons (instant)
  const cannonDefaults = {
    particleCount: 60,
    spread: 55,
    startVelocity: 45,
    gravity: 1.0,
    decay: 0.92,
    ticks: 80,
    colors: brandColors,
    shapes: ['circle', 'square'],
    scalar: 1.1,
  };
  confetti({ ...cannonDefaults, angle: 60, origin: { x: 0, y: 0.65 } });
  confetti({ ...cannonDefaults, angle: 120, origin: { x: 1, y: 0.65 } });

  // Stage 2: Rising center sparkle shower (200ms delay)
  setTimeout(() => {
    confetti({
      particleCount: 40,
      spread: 100,
      startVelocity: 35,
      gravity: 0.8,
      decay: 0.93,
      ticks: 70,
      origin: { x: 0.5, y: 0.75 },
      colors: brandColors,
      shapes: ['circle'],
      scalar: 0.9,
    });
  }, 200);

  // Stage 3: Gentle golden rain from top (500ms delay)
  setTimeout(() => {
    confetti({
      particleCount: 25,
      spread: 160,
      startVelocity: 12,
      gravity: 0.6,
      decay: 0.96,
      ticks: 100,
      origin: { x: 0.5, y: 0 },
      colors: ['#FFD700', '#FFC107', '#FFFFFF', '#36A15D'],
      shapes: ['circle'],
      scalar: 0.7,
      drift: 0.5,
    });
  }, 500);

  // Stage 4: Final twin pops (800ms delay)
  setTimeout(() => {
    confetti({
      particleCount: 20,
      spread: 40,
      startVelocity: 25,
      gravity: 1.2,
      decay: 0.94,
      ticks: 50,
      origin: { x: 0.3, y: 0.5 },
      colors: ['#36A15D', '#0A89CD'],
      scalar: 0.8,
    });
    confetti({
      particleCount: 20,
      spread: 40,
      startVelocity: 25,
      gravity: 1.2,
      decay: 0.94,
      ticks: 50,
      origin: { x: 0.7, y: 0.5 },
      colors: ['#5243AA', '#FFD700'],
      scalar: 0.8,
    });
  }, 800);
};

const KanbanBoard = () => {
  const dispatch = useDispatch();
  const { sprintId: sprintIdParam } = useParams(); // undefined when on /board
  const { user } = useSelector((state) => state.auth);
  const {
    flatTasks,
    sprint,
    isTemporalScrumMaster,
    onlyMyIssues,
    isLoading,
    error,
  } = useSelector((state) => state.kanban);

  const [createOpen, setCreateOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null); // { task, mode }
  const [editTarget, setEditTarget] = useState(null);   // task object
  const [deleteTarget, setDeleteTarget] = useState(null); // task object
  const [collapsedLanes, setCollapsedLanes] = useState({}); // laneKey -> bool

  const isManager = user?.systemRole === 'Admin/Manager';
  const isElevated = isManager || isTemporalScrumMaster;

  // Board is frozen when the sprint is PENDING (planning mode) or COMPLETED (archive mode).
  // During PENDING: card movement is blocked, but issue creation is still allowed.
  // During COMPLETED: all mutations including card creation are blocked.
  const isFrozen = sprint?.status === 'PENDING' || sprint?.status === 'COMPLETED';
  // isArchived is true only for COMPLETED sprints — used to suppress column-level
  // dimming (which was designed for PENDING-only) so the archive board renders
  // as a uniform read-only view rather than showing selective grey columns.
  const isArchived = sprint?.status === 'COMPLETED';
  const FREEZE_MSG =
    sprint?.status === 'COMPLETED'
      ? 'This sprint is archived. No card movement is allowed on a completed sprint.'
      : 'Cannot move tasks until the sprint officially starts.';

  const prevDoneIdsRef = useRef(new Set());
  const lastLoadedSprintIdRef = useRef(null);

  useEffect(() => {
    dispatch(fetchBoard(sprintIdParam ? parseInt(sprintIdParam, 10) : null));
  }, [dispatch, sprintIdParam]);

  // ── Unified status tracking for celebration trigger ─────────────────────────
  useEffect(() => {
    if (isLoading) return;

    const currentSprintIdFromStore = sprint?.id;
    const parsedParamId = sprintIdParam ? parseInt(sprintIdParam, 10) : null;

    // Guard: If the loaded Redux store data is stale (still belongs to a previous sprint),
    // wait until the fetch finishes and updates the sprint details.
    if (currentSprintIdFromStore !== parsedParamId) {
      return;
    }

    const currentDoneIds = new Set(
      flatTasks.filter((t) => t.status === 'DONE').map((t) => t.id)
    );

    // If this is the initial load of a new sprint board, set the baseline tracking ref
    // and skip firing the celebration trigger for this render cycle.
    if (lastLoadedSprintIdRef.current !== currentSprintIdFromStore) {
      lastLoadedSprintIdRef.current = currentSprintIdFromStore;
      prevDoneIdsRef.current = currentDoneIds;
      return;
    }

    // Only fire if we had loaded tasks previously for this specific sprint
    if (prevDoneIdsRef.current.size > 0) {
      const hasNewDone = [...currentDoneIds].some((id) => !prevDoneIdsRef.current.has(id));
      if (hasNewDone) {
        fireCelebration();
      }
    }

    prevDoneIdsRef.current = currentDoneIds;
  }, [flatTasks, isLoading, sprintIdParam, sprint]);

  // ── Advance handler (button clicks) ────────────────────────────────────────
  const handleAdvance = useCallback(
    (task, nextStatus) => {
      if (isFrozen) {
        toast.error(FREEZE_MSG);
        return;
      }
      dispatch(updateStatus({ taskId: task.id, status: nextStatus }));
    },
    [dispatch, isFrozen, FREEZE_MSG]
  );

  const handleReview = (task, mode) => setReviewTarget({ task, mode });
  const handleEdit = useCallback((task) => setEditTarget(task), []);
  const handleDelete = useCallback((task) => setDeleteTarget(task), []);

  // ── Drag-and-drop handler ──────────────────────────────────────────────────
  const handleDragEnd = useCallback(
    (result) => {
      const { destination, draggableId } = result;
      if (!destination) return; // dropped outside

      // droppableId format is "laneKey::STATUS_KEY"
      const targetStatus = destination.droppableId.split('::')[1];
      const taskId = parseInt(draggableId, 10);
      const task = flatTasks.find((t) => t.id === taskId);

      if (!task || task.status === targetStatus) return; // no-op same column

      // Frozen board: card snaps back automatically (state not updated),
      // and the user sees a toast explaining why.
      if (isFrozen) {
        toast.error(FREEZE_MSG);
        return;
      }

      dispatch(updateStatus({ taskId, status: targetStatus }));
    },
    [dispatch, flatTasks, isFrozen, FREEZE_MSG]
  );

  // ── Toggle lane collapse ───────────────────────────────────────────────────
  const toggleLane = (laneKey) => {
    setCollapsedLanes((prev) => ({ ...prev, [laneKey]: !prev[laneKey] }));
  };

  // ── Build swimlanes grouped by parent issue ────────────────────────────────
  // Supports 2-level (Story → Task cards) and 3-level nesting
  // (Story → Task sub-header → Subtask cards).
  const swimlanes = useMemo(() => {
    // Build a full children map for every task, including intermediate parents.
    const childrenOf = {};
    flatTasks.forEach((t) => {
      if (t.parentId !== null && t.parentId !== undefined) {
        (childrenOf[t.parentId] = childrenOf[t.parentId] || []).push(t);
      }
    });

    const hasDirectChildren = (id) => Boolean(childrenOf[id]?.length);
    const flatTaskIds = new Set(flatTasks.map((t) => t.id));

    // A task is "relevant" if the current user (or any descendant) is assigned to it.
    const isMyCard = (t) => !onlyMyIssues || t.assigneeId === user?.id;
    const hasMineDescendant = (t) => {
      if (!onlyMyIssues) return true;
      if (t.assigneeId === user?.id) return true;
      return (childrenOf[t.id] || []).some((c) => hasMineDescendant(c));
    };

    // Top-level: tasks whose parent is absent or outside this sprint's flatTasks.
    const topLevelTasks = flatTasks.filter(
      (t) => !t.parentId || !flatTaskIds.has(t.parentId)
    );

    const lanes = [];
    const standaloneCards = [];

    topLevelTasks.forEach((top) => {
      if (!hasMineDescendant(top)) return;

      if (!hasDirectChildren(top.id)) {
        // Standalone leaf — collect for the catch-all lane.
        if (isMyCard(top)) standaloneCards.push(top);
        return;
      }

      const directChildren = childrenOf[top.id] || [];

      // Split direct children: those that are themselves parents (→ sublanes)
      // vs pure leaves (→ flat cards directly under the lane header).
      const leafChildren   = directChildren.filter((c) => !hasDirectChildren(c.id) && isMyCard(c));
      const parentChildren = directChildren.filter((c) => hasDirectChildren(c.id) && hasMineDescendant(c));

      if (parentChildren.length === 0) {
        // Pure 2-level: Story → Task cards (original behaviour).
        lanes.push({
          key: `lane-${top.id}`,
          header: top,
          cards: leafChildren,
          sublanes: null,
        });
      } else {
        // 3-level (or 4-level): at least one child is itself a parent.
        // Each parent-child becomes a collapsible sub-lane.
        // Inside each sub-lane, check again: if any grandchild is also a
        // parent (e.g. Task has Subtasks), create a sub-sub-lane for it.
        const sublanes = parentChildren.map((child) => {
          const grandchildren = (childrenOf[child.id] || []).filter(hasMineDescendant);
          const leafGrandchildren   = grandchildren.filter((gc) => !hasDirectChildren(gc.id) && isMyCard(gc));
          const parentGrandchildren = grandchildren.filter((gc) =>  hasDirectChildren(gc.id) && hasMineDescendant(gc));

          const subsublanes = parentGrandchildren.map((gc) => ({
            key: `subsublane-${gc.id}`,
            header: gc,
            cards: (childrenOf[gc.id] || []).filter(isMyCard),
          }));

          return {
            key: `sublane-${child.id}`,
            header: child,
            cards: leafGrandchildren,
            subsublanes: subsublanes.length > 0 ? subsublanes : null,
          };
        });

        lanes.push({
          key: `lane-${top.id}`,
          header: top,
          cards: leafChildren,
          sublanes,
        });
      }
    });

    // Catch-all lane for standalone top-level issues (no parent, no children).
    if (standaloneCards.length > 0) {
      lanes.push({ key: 'lane-standalone', header: null, cards: standaloneCards, sublanes: null });
    }

    return lanes;
  }, [flatTasks, onlyMyIssues, user]);

  const cardsByStatus = (cards) =>
    COLUMNS.reduce((acc, col) => {
      acc[col.key] = cards.filter((c) => c.status === col.key);
      return acc;
    }, {});

  // ── Count cards per column for column headers ──────────────────────────────
  const globalColumnCounts = useMemo(() => {
    const counts = {};
    COLUMNS.forEach((col) => {
      counts[col.key] = flatTasks.filter((t) => t.status === col.key).length;
    });
    return counts;
  }, [flatTasks]);

  return (
    <Layout pageTitle="Sprint Board">
      <div className="flex h-full flex-col">
        {/* ── Header bar ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 border-b border-[#DFE1E6]/60 bg-white/80 backdrop-blur-md px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#0A89CD]/10 to-[#36A15D]/10 ring-1 ring-[#0A89CD]/10">
              <LayoutGrid className="h-5 w-5 text-[#0A89CD]" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[#172B4D]">
                {sprint ? sprint.name : 'Sprint Board'}
              </h1>
              <p className="flex items-center gap-1.5 text-xs text-[#6B778C]">
                {sprint
                  ? `${sprint.startDate} → ${sprint.endDate}`
                  : 'No active sprint for your team'}
                {isTemporalScrumMaster && (
                  <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-[#E3FCEF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#006644] ring-1 ring-[#006644]/10">
                    <Sparkles className="h-3 w-3" />
                    Scrum Master
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="group flex cursor-pointer items-center gap-2 rounded-lg border border-[#DFE1E6]/80 bg-white/60 px-3.5 py-2 text-xs font-semibold text-[#42526E] backdrop-blur-sm transition-all hover:border-[#0A89CD]/30 hover:shadow-sm">
              <input
                type="checkbox"
                checked={onlyMyIssues}
                onChange={() => dispatch(toggleMyIssues())}
                className="h-3.5 w-3.5 rounded border-[#C1C7D0] text-[#0A89CD] focus:ring-[#0A89CD]/40 focus:ring-offset-0"
              />
              <Filter className="h-3.5 w-3.5 text-[#97A0AF] transition-colors group-hover:text-[#0A89CD]" />
              Only My Issues
            </label>
            <button
              onClick={() => dispatch(fetchBoard(sprintIdParam ? parseInt(sprintIdParam, 10) : null))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFE1E6]/80 bg-white/60 px-3.5 py-2 text-xs font-semibold text-[#42526E] backdrop-blur-sm transition-all hover:border-[#0A89CD]/30 hover:shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-[#0A89CD]' : 'text-[#97A0AF]'}`} />
              Refresh
            </button>
            {sprint?.status !== 'COMPLETED' && (
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0747A6] to-[#0A3D8F] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-lg hover:shadow-blue-500/30 hover:brightness-110 active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                Create
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-xl border border-[#FFBDAD]/60 bg-[#FFEBE6]/80 px-4 py-2.5 text-sm text-[#DE350B] backdrop-blur-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Planning-mode freeze banner (PENDING sprints) ─────────────────── */}
        {sprint?.status === 'PENDING' && (
          <div className="mx-5 mt-3 flex items-center gap-3 rounded-xl border border-amber-300/60 bg-amber-50/90 px-4 py-2.5 backdrop-blur-sm">
            <Lock className="h-4 w-4 flex-shrink-0 text-amber-600" />
            <div>
              <span className="text-xs font-bold text-amber-800">Planning Mode — Board Frozen</span>
              <span className="ml-2 text-xs text-amber-700">
                Tasks can be created in <strong>To Do</strong>, but cannot be moved until the sprint is force-started by a Manager.
              </span>
            </div>
          </div>
        )}

        {/* ── Archive-mode freeze banner (COMPLETED sprints) ───────────────── */}
        {sprint?.status === 'COMPLETED' && (
          <div className="mx-5 mt-3 flex items-center gap-3 rounded-xl border border-slate-300/60 bg-slate-50/90 px-4 py-2.5 backdrop-blur-sm">
            <Archive className="h-4 w-4 flex-shrink-0 text-slate-500" />
            <div>
              <span className="text-xs font-bold text-slate-700">Sprint Archived — Read-Only</span>
              <span className="ml-2 text-xs text-slate-600">
                This sprint is complete. The board is a permanent historical record and cannot be modified.
              </span>
            </div>
          </div>
        )}

        {/* ── Board ──────────────────────────────────────────────────────── */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="mt-4 flex-1 overflow-auto px-3 pb-6">
            <div className="min-w-[1060px] overflow-hidden rounded-t-lg border border-[#DFE1E6] bg-white">

              {/* Column headers — unified bordered row like Jira */}
              <div className="sticky top-0 z-10 grid grid-cols-5 border-b-2 border-[#DFE1E6] bg-[#FAFBFC]">
                {COLUMNS.map((col, idx) => (
                  <div
                    key={col.key}
                    className={`flex items-center justify-between px-4 py-3 ${idx < COLUMNS.length - 1 ? 'border-r border-[#DFE1E6]' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${col.dotColor}`} />
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${col.accent.split(' ').find(c => c.startsWith('text-')) || 'text-[#6B778C]'}`}>
                        {col.label}
                      </span>
                    </div>
                    <span className="rounded-full bg-[#EBECF0] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[#42526E]">
                      {globalColumnCounts[col.key] || 0}
                    </span>
                  </div>
                ))}
              </div>

              {/* Swimlanes */}
              {isLoading && swimlanes.length === 0 ? (
                <div className="flex items-center justify-center rounded-2xl border border-[#DFE1E6]/40 bg-white/60 py-24 backdrop-blur-md">
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="h-7 w-7 animate-spin text-[#0A89CD]" />
                    <p className="text-xs font-medium text-[#6B778C]">Loading board…</p>
                  </div>
                </div>
              ) : swimlanes.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-[#DFE1E6]/40 bg-white/60 py-24 backdrop-blur-md">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F4F5F7] to-white shadow-inner">
                    <Layers className="h-8 w-8 text-[#C1C7D0]" />
                  </div>
                  {sprint?.status === 'PENDING' ? (
                    <>
                      <p className="mt-4 text-sm font-semibold text-[#6B778C]">
                        Planning board is empty
                      </p>
                      <p className="mt-1 text-xs text-[#97A0AF] text-center max-w-xs">
                        This sprint is in planning mode. Use the <strong>Create</strong> button to add tasks to the backlog before the sprint starts.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-4 text-sm font-semibold text-[#6B778C]">
                        No issues on the board yet
                      </p>
                      <p className="mt-1 text-xs text-[#97A0AF]">
                        Create an issue to get the sprint moving.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-[#DFE1E6]">
                  {swimlanes.map((lane) => {
                    const flatCards     = lane.cards || [];
                    const grouped       = cardsByStatus(flatCards);
                    const isCollapsed   = collapsedLanes[lane.key] || false;
                    const hasFlatCards  = flatCards.length > 0;
                    const hasSublanes   = Boolean(lane.sublanes?.length);
                    const totalCount    =
                      flatCards.length +
                      (lane.sublanes?.reduce((s, sl) =>
                        s + (sl.cards?.length || 0) +
                        (sl.subsublanes?.reduce((ss, ssl) => ss + ssl.cards.length, 0) || 0),
                      0) || 0);

                    return (
                      <div
                        key={lane.key}
                        className="bg-white transition-all duration-200"
                      >
                        {/* ── Swimlane header ─────────────────────────────── */}
                        <div className="group/lane flex w-full items-center gap-3 border-b border-[#DFE1E6]/30 px-4 py-3 transition-colors hover:bg-[#F4F5F7]/50">
                          {/* Collapse toggle — spans most of the row */}
                          <button
                            onClick={() => toggleLane(lane.key)}
                            className="flex flex-1 min-w-0 items-center gap-3 text-left"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#97A0AF] transition-transform" />
                            ) : (
                              <ChevronDown className="h-4 w-4 flex-shrink-0 text-[#97A0AF] transition-transform" />
                            )}

                            {lane.header ? (
                              <>
                                <div className={`h-6 w-1 flex-shrink-0 rounded-full ${TYPE_DOT[lane.header.type] || 'bg-[#0A89CD]'}`} />
                                <span
                                  className={`inline-flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TYPE_LOZENGE[lane.header.type] || TYPE_LOZENGE.Task}`}
                                >
                                  {lane.header.type}
                                </span>
                                <span className="flex-shrink-0 font-mono text-[11px] font-semibold text-[#97A0AF]">
                                  {lane.header.issueKey}
                                </span>
                                <span className="truncate text-sm font-bold tracking-tight text-[#172B4D]">
                                  {lane.header.title}
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="h-6 w-1 flex-shrink-0 rounded-full bg-[#97A0AF]" />
                                <span className="text-sm font-bold tracking-tight text-[#6B778C]">
                                  Standalone Issues
                                </span>
                              </>
                            )}
                          </button>

                          {/* Mutation controls — hidden only on COMPLETED (archived) boards.
                              PENDING (planning) sprints still allow edit and delete. */}
                          {lane.header && !isArchived && (
                            <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/lane:opacity-100">
                              <button
                                onClick={() => handleEdit(lane.header)}
                                title="Edit issue"
                                className="inline-flex h-6 w-6 items-center justify-center rounded text-[#97A0AF] transition-colors hover:bg-[#EBECF0] hover:text-[#172B4D]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {(isElevated || lane.header.creatorId === user?.id) && (
                                <button
                                  onClick={() => handleDelete(lane.header)}
                                  title="Delete hierarchy"
                                  className="inline-flex h-6 w-6 items-center justify-center rounded text-[#97A0AF] transition-colors hover:bg-[#FFEBE6] hover:text-[#DE350B]"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}

                          <span className="flex-shrink-0 rounded-full bg-[#EBECF0]/80 px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-[#42526E]">
                            {totalCount}
                          </span>
                        </div>

                        {!isCollapsed && (
                          <>
                            {/* ── Flat card grid (Tasks without their own subtasks) ── */}
                            {hasFlatCards && (
                              <div className="grid grid-cols-5">
                                {COLUMNS.map((col, idx) => (
                                  <div
                                    key={col.key}
                                    className={`${idx < COLUMNS.length - 1 ? 'border-r border-[#DFE1E6]' : ''} bg-[#F7F8F9]`}
                                  >
                                    <KanbanColumn
                                      columnKey={col.key}
                                      laneKey={lane.key}
                                      tasks={grouped[col.key]}
                                      currentUser={user}
                                      isElevated={isElevated}
                                      isFrozen={isFrozen}
                                      isArchived={isArchived}
                                      onAdvance={handleAdvance}
                                      onReview={handleReview}
                                      onEdit={handleEdit}
                                      onDelete={handleDelete}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* ── Sub-lane sections (children that are themselves parents) ── */}
                            {hasSublanes && lane.sublanes.map((sublane) => {
                              const subGrouped       = cardsByStatus(sublane.cards || []);
                              const isSubCollapsed   = collapsedLanes[sublane.key] || false;
                              const hasSubFlat       = (sublane.cards || []).length > 0;
                              const hasSubSublanes   = Boolean(sublane.subsublanes?.length);
                              const subTotalCount    =
                                (sublane.cards || []).length +
                                (sublane.subsublanes?.reduce((s, ssl) => s + ssl.cards.length, 0) || 0);

                              return (
                                <div key={sublane.key} className="border-t border-[#DFE1E6]/50">
                                  {/* Sub-lane header */}
                                  <div className="group/sublane flex w-full items-center gap-3 border-b border-[#DFE1E6]/20 bg-[#F4F5F7]/60 py-2 pl-8 pr-4 transition-colors hover:bg-[#EBECF0]/50">
                                    <button
                                      onClick={() => toggleLane(sublane.key)}
                                      className="flex flex-1 min-w-0 items-center gap-2.5 text-left"
                                    >
                                      {isSubCollapsed ? (
                                        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-[#97A0AF]" />
                                      ) : (
                                        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-[#97A0AF]" />
                                      )}
                                      <div className={`h-5 w-1 flex-shrink-0 rounded-full ${TYPE_DOT[sublane.header.type] || 'bg-[#0A89CD]'}`} />
                                      <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${TYPE_LOZENGE[sublane.header.type] || TYPE_LOZENGE.Task}`}>
                                        {sublane.header.type}
                                      </span>
                                      <span className="flex-shrink-0 font-mono text-[10px] font-semibold text-[#97A0AF]">
                                        {sublane.header.issueKey}
                                      </span>
                                      <span className="truncate text-xs font-semibold text-[#172B4D]">
                                        {sublane.header.title}
                                      </span>
                                    </button>
                                    {!isArchived && (
                                      <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/sublane:opacity-100">
                                        <button
                                          onClick={() => handleEdit(sublane.header)}
                                          title="Edit issue"
                                          className="inline-flex h-5 w-5 items-center justify-center rounded text-[#97A0AF] transition-colors hover:bg-[#DFE1E6] hover:text-[#172B4D]"
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                        {(isElevated || sublane.header.creatorId === user?.id) && (
                                          <button
                                            onClick={() => handleDelete(sublane.header)}
                                            title="Delete hierarchy"
                                            className="inline-flex h-5 w-5 items-center justify-center rounded text-[#97A0AF] transition-colors hover:bg-[#FFEBE6] hover:text-[#DE350B]"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                    <span className="flex-shrink-0 rounded-full bg-[#EBECF0] px-2 py-0.5 text-[9px] font-bold tabular-nums text-[#42526E]">
                                      {subTotalCount}
                                    </span>
                                  </div>

                                  {!isSubCollapsed && (
                                    <>
                                      {/* Flat leaf cards directly under this sub-lane */}
                                      {hasSubFlat && (
                                        <div className="grid grid-cols-5">
                                          {COLUMNS.map((col, idx) => (
                                            <div
                                              key={col.key}
                                              className={`${idx < COLUMNS.length - 1 ? 'border-r border-[#DFE1E6]' : ''} bg-[#F7F8F9]`}
                                            >
                                              <KanbanColumn
                                                columnKey={col.key}
                                                laneKey={sublane.key}
                                                tasks={subGrouped[col.key]}
                                                currentUser={user}
                                                isElevated={isElevated}
                                                isFrozen={isFrozen}
                                                isArchived={isArchived}
                                                onAdvance={handleAdvance}
                                                onReview={handleReview}
                                                onEdit={handleEdit}
                                                onDelete={handleDelete}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Sub-sub-lanes (e.g. Task with Subtasks inside a Story sublane) */}
                                      {hasSubSublanes && sublane.subsublanes.map((ssl) => {
                                        const sslGrouped     = cardsByStatus(ssl.cards || []);
                                        const isSslCollapsed = collapsedLanes[ssl.key] || false;

                                        return (
                                          <div key={ssl.key} className="border-t border-[#DFE1E6]/40">
                                            {/* Sub-sub-lane header — deeper indent pl-16 */}
                                            <div className="group/ssl flex w-full items-center gap-3 border-b border-[#DFE1E6]/20 bg-[#EBECF0]/40 py-1.5 pl-16 pr-4 transition-colors hover:bg-[#DFE1E6]/50">
                                              <button
                                                onClick={() => toggleLane(ssl.key)}
                                                className="flex flex-1 min-w-0 items-center gap-2 text-left"
                                              >
                                                {isSslCollapsed ? (
                                                  <ChevronRight className="h-3 w-3 flex-shrink-0 text-[#97A0AF]" />
                                                ) : (
                                                  <ChevronDown className="h-3 w-3 flex-shrink-0 text-[#97A0AF]" />
                                                )}
                                                <div className={`h-4 w-0.5 flex-shrink-0 rounded-full ${TYPE_DOT[ssl.header.type] || 'bg-[#0A89CD]'}`} />
                                                <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider ${TYPE_LOZENGE[ssl.header.type] || TYPE_LOZENGE.Task}`}>
                                                  {ssl.header.type}
                                                </span>
                                                <span className="flex-shrink-0 font-mono text-[9px] font-semibold text-[#97A0AF]">
                                                  {ssl.header.issueKey}
                                                </span>
                                                <span className="truncate text-[11px] font-semibold text-[#172B4D]">
                                                  {ssl.header.title}
                                                </span>
                                              </button>
                                              {!isArchived && (
                                                <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/ssl:opacity-100">
                                                  <button
                                                    onClick={() => handleEdit(ssl.header)}
                                                    title="Edit issue"
                                                    className="inline-flex h-4 w-4 items-center justify-center rounded text-[#97A0AF] transition-colors hover:bg-[#DFE1E6] hover:text-[#172B4D]"
                                                  >
                                                    <Pencil className="h-2.5 w-2.5" />
                                                  </button>
                                                  {(isElevated || ssl.header.creatorId === user?.id) && (
                                                    <button
                                                      onClick={() => handleDelete(ssl.header)}
                                                      title="Delete hierarchy"
                                                      className="inline-flex h-4 w-4 items-center justify-center rounded text-[#97A0AF] transition-colors hover:bg-[#FFEBE6] hover:text-[#DE350B]"
                                                    >
                                                      <Trash2 className="h-2.5 w-2.5" />
                                                    </button>
                                                  )}
                                                </div>
                                              )}
                                              <span className="flex-shrink-0 rounded-full bg-[#DFE1E6] px-1.5 py-0.5 text-[8px] font-bold tabular-nums text-[#42526E]">
                                                {ssl.cards.length}
                                              </span>
                                            </div>

                                            {/* Sub-sub-lane card grid */}
                                            {!isSslCollapsed && (
                                              <div className="grid grid-cols-5">
                                                {COLUMNS.map((col, idx) => (
                                                  <div
                                                    key={col.key}
                                                    className={`${idx < COLUMNS.length - 1 ? 'border-r border-[#DFE1E6]' : ''} bg-[#F7F8F9]`}
                                                  >
                                                    <KanbanColumn
                                                      columnKey={col.key}
                                                      laneKey={ssl.key}
                                                      tasks={sslGrouped[col.key]}
                                                      currentUser={user}
                                                      isElevated={isElevated}
                                                      isFrozen={isFrozen}
                                                      isArchived={isArchived}
                                                      onAdvance={handleAdvance}
                                                      onReview={handleReview}
                                                      onEdit={handleEdit}
                                                      onDelete={handleDelete}
                                                    />
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DragDropContext>
      </div>

      {createOpen && <CreateIssueModal onClose={() => setCreateOpen(false)} />}
      {reviewTarget && (
        <ReviewAdjudicationModal
          task={reviewTarget.task}
          mode={reviewTarget.mode}
          onClose={() => setReviewTarget(null)}
        />
      )}
      {editTarget && (
        <EditIssueModal
          task={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmationModal
          task={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </Layout>
  );
};

export default KanbanBoard;
