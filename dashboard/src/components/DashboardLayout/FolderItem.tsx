import {
  faChevronDown,
  faChevronRight,
  faFolder,
  faFolderOpen,
  faTrash,
  faPlay,
  faStop,
  faArrowRotateBackward,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { RadioGroup } from '@headlessui/react';
import InstancePill from 'components/InstancePill';
import { Folder, useFolders } from 'data/FolderContext';
import { InstanceContext } from 'data/InstanceContext';
import { useContext, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { InstanceInfo } from 'bindings/InstanceInfo';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useQueryClient } from '@tanstack/react-query';
import { axiosWrapper, errorToString } from 'utils/util';

export default function FolderItem({
  folder,
}: {
  folder: Folder;
}) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const { instanceList } = useContext(InstanceContext);
  const { deleteFolder } = useFolders();
  const queryClient = useQueryClient();

  const { setNodeRef, isOver } = useDroppable({ id: folder.id });

  const folderInstances = folder.instanceUuids
    .map((uuid) => instanceList?.[uuid])
    .filter((i): i is InstanceInfo => !!i);

  /** Run an async action over a filtered set of instances and report a summary. */
  async function runBatch(
    label: string,
    filter: (i: InstanceInfo) => boolean,
    action: (i: InstanceInfo) => Promise<unknown>
  ) {
    if (busy) return;
    const targets = folderInstances.filter(filter);
    if (targets.length === 0) {
      toast.info(`Keine passenden Server für "${label}".`);
      return;
    }
    setBusy(true);
    const results = await Promise.allSettled(targets.map(action));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    queryClient.invalidateQueries(['instances', 'list']);
    if (failed === 0) {
      toast.success(`${label}: ${ok} Server`);
    } else {
      toast.warning(`${label}: ${ok} ok, ${failed} fehlgeschlagen`);
    }
    setBusy(false);
  }

  const startAll = () =>
    runBatch(
      'Gestartet',
      (i) => i.state === 'Stopped' || i.state === 'Error',
      (i) => axios.put(`/instance/${i.uuid}/start`)
    );

  const stopAll = () =>
    runBatch(
      'Gestoppt',
      (i) => i.state === 'Running',
      (i) => axios.put(`/instance/${i.uuid}/stop`)
    );

  const restartAll = () =>
    runBatch(
      'Neugestartet',
      (i) => i.state === 'Running' || i.state === 'Error',
      (i) => axios.put(`/instance/${i.uuid}/restart`)
    );

  const deleteAll = async () => {
    if (busy) return;
    if (folderInstances.length === 0) {
      // empty folder → just remove the folder itself
      deleteFolder(folder.id);
      return;
    }
    const confirmed = window.confirm(
      `Wirklich ALLE ${folderInstances.length} Server im Ordner "${folder.name}" unwiderruflich löschen? Welten und Backups gehen verloren.`
    );
    if (!confirmed) return;
    await runBatch(
      'Gelöscht',
      () => true,
      (i) => axiosWrapper({ method: 'DELETE', url: `/instance/${i.uuid}` })
    ).catch((err) => toast.error(errorToString(err)));
    deleteFolder(folder.id);
  };

  const actionBtn = 'p-1 rounded transition-colors disabled:opacity-30';

  return (
    <div
      ref={setNodeRef}
      className={`rounded-md transition-colors ${isOver ? 'bg-gray-700/40' : ''}`}
    >
      {/* Folder header */}
      <div className="flex items-center gap-x-1 py-0.5 px-1 group">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-x-1.5 text-small font-semibold text-gray-faded/50 hover:text-gray-300 transition-colors"
        >
          <FontAwesomeIcon
            icon={open ? faFolderOpen : faFolder}
            className="text-yellow-400/70 w-3"
          />
          <span className="truncate">{folder.name}</span>
          {folderInstances.length > 0 && (
            <span className="text-xs opacity-40">({folderInstances.length})</span>
          )}
          <FontAwesomeIcon
            icon={open ? faChevronDown : faChevronRight}
            className="ml-auto text-xs opacity-50"
          />
        </button>

        {/* Batch actions */}
        <div className="flex items-center gap-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={startAll}
            disabled={busy}
            className={`${actionBtn} text-green-400 hover:bg-green-500/20`}
            title="Alle starten"
          >
            <FontAwesomeIcon icon={faPlay} className="text-xs" />
          </button>
          <button
            onClick={stopAll}
            disabled={busy}
            className={`${actionBtn} text-gray-300 hover:bg-gray-500/20`}
            title="Alle stoppen"
          >
            <FontAwesomeIcon icon={faStop} className="text-xs" />
          </button>
          <button
            onClick={restartAll}
            disabled={busy}
            className={`${actionBtn} text-blue-400 hover:bg-blue-500/20`}
            title="Alle neustarten"
          >
            <FontAwesomeIcon icon={faArrowRotateBackward} className="text-xs" />
          </button>
          <button
            onClick={deleteAll}
            disabled={busy}
            className={`${actionBtn} text-red-400 hover:bg-red-500/20`}
            title={
              folderInstances.length > 0
                ? 'Alle Server löschen + Ordner entfernen'
                : 'Ordner löschen'
            }
          >
            <FontAwesomeIcon icon={faTrash} className="text-xs" />
          </button>
        </div>
      </div>

      {/* Folder instances */}
      {open && (
        <div className="ml-2 flex flex-col gap-y-1">
          {folderInstances.length === 0 ? (
            <p className="text-small italic text-gray-faded/25 px-2 py-1">
              {isOver ? 'Hier ablegen...' : 'Leer'}
            </p>
          ) : (
            folderInstances.map((instance) =>
              instance ? (
                <RadioGroup.Option
                  key={instance.uuid}
                  value={instance}
                  className="rounded-md outline-none child:w-full"
                >
                  <InstancePill {...instance} />
                </RadioGroup.Option>
              ) : null
            )
          )}
        </div>
      )}
    </div>
  );
}
