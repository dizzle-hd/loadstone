import { faChevronDown, faChevronRight, faFolder, faFolderOpen, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { RadioGroup } from '@headlessui/react';
import InstancePill from 'components/InstancePill';
import { Folder, useFolders } from 'data/FolderContext';
import { InstanceContext } from 'data/InstanceContext';
import { useContext, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { InstanceInfo } from 'bindings/InstanceInfo';

export default function FolderItem({
  folder,
}: {
  folder: Folder;
}) {
  const [open, setOpen] = useState(true);
  const { instanceList } = useContext(InstanceContext);
  const { deleteFolder } = useFolders();

  const { setNodeRef, isOver } = useDroppable({ id: folder.id });

  const folderInstances = folder.instanceUuids
    .map((uuid) => instanceList?.[uuid])
    .filter((i): i is InstanceInfo => !!i);

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
          <FontAwesomeIcon
            icon={open ? faChevronDown : faChevronRight}
            className="ml-auto text-xs opacity-50"
          />
        </button>
        <button
          onClick={() => deleteFolder(folder.id)}
          className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-red-400 transition-opacity p-0.5"
          title="Ordner löschen"
        >
          <FontAwesomeIcon icon={faTrash} className="text-xs" />
        </button>
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
