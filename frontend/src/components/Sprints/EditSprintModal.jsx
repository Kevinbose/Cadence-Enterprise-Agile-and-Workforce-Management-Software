import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AlertCircle, Loader2, Pencil, X } from 'lucide-react';
import { editSprint } from '../../features/sprints/sprintSlice';

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold uppercase tracking-wider text-[#6B778C]">
      {label}
    </label>
    {children}
  </div>
);

const inputCls =
  'w-full rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] px-3.5 py-2.5 text-sm text-[#172B4D] placeholder-[#C1C7D0] outline-none transition-all focus:border-[#0A89CD] focus:bg-white focus:ring-2 focus:ring-[#0A89CD]/20';

const EditSprintModal = ({ isOpen, onClose, sprint }) => {
  const dispatch = useDispatch();
  const { isSubmitting, error } = useSelector((s) => s.sprint);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const [localErr, setLocalErr] = useState('');

  useEffect(() => {
    if (sprint) {
      setForm({
        name: sprint.name || '',
        startDate: sprint.startDate || '',
        endDate: sprint.endDate || '',
      });
      setLocalErr('');
    }
  }, [sprint]);

  if (!isOpen || !sprint) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      setLocalErr('All fields are required.');
      return;
    }
    if (form.startDate >= form.endDate) {
      setLocalErr('End date must be after start date.');
      return;
    }

    const result = await dispatch(
      editSprint({
        id: sprint.id,
        data: {
          name: form.name.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
        },
      })
    );

    if (!result.error) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172B4D]/40 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-[#DFE1E6]">
        <div className="flex items-center justify-between border-b border-[#DFE1E6] bg-[#F4F5F7]/60 px-6 py-4">
          <h2 className="text-sm font-bold tracking-tight text-[#172B4D]">Edit Sprint</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#6B778C] transition-colors hover:bg-[#EBECF0] hover:text-[#172B4D]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {(localErr || error) && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#FFBDAD]/60 bg-[#FFEBE6]/80 px-4 py-3 text-sm text-[#DE350B]">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {localErr || error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Sprint Name *">
              <input
                type="text"
                value={form.name}
                onChange={(e) => {
                  setForm((p) => ({ ...p, name: e.target.value }));
                  setLocalErr('');
                }}
                placeholder="e.g. Sprint 32 — Q3 Feature Build"
                className={inputCls}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date *">
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="End Date *">
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                  className={inputCls}
                  required
                />
              </Field>
            </div>

            {/* Temporal auto-transition hint */}
            <div className="flex items-start gap-2 rounded-xl border border-[#0A89CD]/25 bg-[#DEEBFF]/60 px-3.5 py-2.5">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#0052CC]" />
              <p className="text-[11px] leading-relaxed text-[#0052CC]">
                <strong>Note:</strong> Changing the start date to today will auto-start the sprint.
                Changing the end date to the past will auto-complete it.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#DFE1E6]/60 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#DFE1E6] bg-white px-4 py-2 text-sm font-semibold text-[#42526E] hover:bg-[#F4F5F7]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0747A6] to-[#0A3D8F] px-5 py-2 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:brightness-110 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Pencil className="h-3.5 w-3.5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditSprintModal;
