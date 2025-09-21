import React from 'react';
import { APIClient, APIClientError } from '@/services/api';

interface CompilePanelProps {
  initialMasters?: string;
  initialPlan?: string;
  onClose: () => void;
  onApplyTemplate: (parsedTemplate: any, yaml: string) => void;
}

const placeholderMasters = `masters:
  - name: Index
    widgets:
      - id: title
        type: text_block
        page: 1
        position: { x: 72, y: 780, width: 451, height: 24 }
        content: "Index"
      - id: anchor_home
        type: anchor
        page: 1
        position: { x: 72, y: 780, width: 1, height: 1 }
        properties: { dest_id: "home:index" }
      - id: notes_grid
        type: grid
        page: 1
        position: { x: 72, y: 640, width: 451, height: 180 }
        properties:
          rows: 5
          cols: 2
          data_source: "range(1, 11)"
          cell_template:
            id: note_link
            type: internal_link
            position: { x: 0, y: 0, width: 0, height: 0 }
            content: "Note {@cell_value}"
            properties:
              bind: "notes(@cell_value)"
      - id: to_year
        type: internal_link
        page: 1
        position: { x: 72, y: 580, width: 180, height: 20 }
        content: "2026 Calendar →"
        properties:
          bind: "year(2026)"

  - name: Year
    widgets:
      - id: anchor_year
        type: anchor
        page: 1
        position: { x: 72, y: 780, width: 1, height: 1 }
        properties: { dest_id: "year:{year}" }
      - id: title
        type: text_block
        page: 1
        position: { x: 72, y: 780, width: 451, height: 24 }
        content: "Year {year}"
      - id: year_calendar
        type: calendar_year
        page: 1
        position: { x: 72, y: 120, width: 451, height: 640 }
        properties:
          year: "{year}"
          month_cell:
            link:
              bind: "month(@cell_month)"
      - id: back_home
        type: internal_link
        page: 1
        position: { x: 72, y: 60, width: 140, height: 18 }
        content: "← Index"
        properties: { to_dest: "home:index" }

  - name: Month
    widgets:
      - id: anchor_month
        type: anchor
        page: 1
        position: { x: 72, y: 780, width: 1, height: 1 }
        properties: { dest_id: "month:{year}-{month:02d}" }
      - id: heading
        type: text_block
        page: 1
        position: { x: 72, y: 780, width: 451, height: 24 }
        content: "{month_name} {year}"
      - id: month_calendar
        type: calendar_month
        page: 1
        position: { x: 72, y: 140, width: 451, height: 540 }
        properties:
          month: "{year}-{month:02d}"
          start_week_on: "mon"
          day_cell:
            link:
              bind: "day(@cell_date)#1"
      - id: to_year
        type: internal_link
        page: 1
        position: { x: 72, y: 60, width: 140, height: 18 }
        content: "← Year"
        properties:
          bind: "year({year})"

  - name: Day
    widgets:
      - id: title
        type: text_block
        page: 1
        position: { x: 72, y: 780, width: 451, height: 24 }
        content: "{date_long}"
      - id: anchor_day_group
        type: anchor
        page: 1
        position: { x: 72, y: 780, width: 1, height: 1 }
        properties: { dest_id: "day:{date}" }
      - id: anchor_day_sub
        type: anchor
        page: 1
        position: { x: 74, y: 780, width: 1, height: 1 }
        properties: { dest_id: "day:{date}#{subpage}" }
      - id: back_to_month
        type: internal_link
        page: 1
        position: { x: 72, y: 60, width: 160, height: 18 }
        content: "← Month"
        properties:
          bind: "month({year}-{month:02d})"

  - name: NotePage
    widgets:
      - id: anchor_note
        type: anchor
        page: 1
        position: { x: 72, y: 780, width: 1, height: 1 }
        properties: { dest_id: "notes:page:{index_padded}" }
      - id: heading
        type: text_block
        page: 1
        position: { x: 72, y: 780, width: 451, height: 24 }
        content: "Note {index}"
      - id: back_to_index
        type: internal_link
        page: 1
        position: { x: 72, y: 60, width: 120, height: 18 }
        content: "← Index"
        properties: { to_dest: "home:index" }
`;

const placeholderPlan = `name: \"Planner 2026\"\nprofile: boox-note-air-4c\nplan:\n  calendar:\n    start_date: 2026-01-01\n    end_date: 2026-12-31\n    pages_per_day: 1\n  sections:\n    - kind: index\n      master: \"Index\"\n      generate: once\n    - kind: notes_pages\n      master: \"NotePage\"\n      generate: count\n      count: 10\n    - kind: year_page\n      master: \"Year\"\n      generate: once\n      context:\n        year: 2026\n    - kind: month_pages\n      master: \"Month\"\n      generate: each_month\n      start_date: 2026-01-01\n      end_date: 2026-12-31\n    - kind: day_pages\n      master: \"Day\"\n      generate: each_day\n      start_date: 2026-01-01\n      end_date: 2026-12-31\n      pages_per_item: 1\n  order:\n    - index\n    - notes_pages\n    - year_page\n    - month_pages\n    - day_pages\n`;

const CompilePanel: React.FC<CompilePanelProps> = ({ initialMasters, initialPlan, onClose, onApplyTemplate }) => {
  const [masters, setMasters] = React.useState<string>(initialMasters || placeholderMasters);
  const [plan, setPlan] = React.useState<string>(initialPlan || placeholderPlan);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleCompile = async () => {
    setBusy(true); setError(null);
    try {
      const resp = await APIClient.compileBuild(masters, plan);
      onApplyTemplate(resp.parsed_template, resp.yaml_content);
    } catch (e: any) {
      if (e instanceof APIClientError) setError(e.apiError.message); else setError('Compilation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white w-[900px] max-w-[95vw] max-h-[90vh] rounded shadow-lg overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Build From Masters + Plan</h3>
          <button onClick={onClose} className="px-2 py-1 text-sm border rounded">Close</button>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-0 overflow-auto">
          <div className="p-4 border-r">
            <div className="mb-2 text-sm font-medium">Master Library YAML</div>
            <textarea className="w-full h-[55vh] input-field font-mono text-xs" value={masters} onChange={e=>setMasters(e.target.value)} />
          </div>
          <div className="p-4">
            <div className="mb-2 text-sm font-medium">Plan YAML</div>
            <textarea className="w-full h-[55vh] input-field font-mono text-xs" value={plan} onChange={e=>setPlan(e.target.value)} />
          </div>
        </div>
        {error && <div className="px-4 py-2 text-sm text-red-600 border-t">{error}</div>}
        <div className="p-4 border-t flex items-center justify-end space-x-2">
          <button onClick={handleCompile} disabled={busy} className="btn-primary">
            {busy ? 'Compiling…' : 'Compile & Open'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompilePanel;
