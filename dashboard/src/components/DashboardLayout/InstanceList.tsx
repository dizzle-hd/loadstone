import { faExpand, faFolderPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { RadioGroup } from '@headlessui/react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import InstanceLoadingPill from 'components/InstanceLoadingPill';
import InstancePill from 'components/InstancePill';
import { InstanceContext } from 'data/InstanceContext';
import { NotificationContext } from 'data/NotificationContext';
import { useUserLoggedIn } from 'data/UserInfo';
import { useFolders, FolderProvider } from 'data/FolderContext';
import FolderItem from './FolderItem';
import { useContext, useEffect, useState } from 'react';
import useAnalyticsEventTracker from 'utils/hooks';
import { match, otherwise } from 'variant';
import { BrowserLocationContext } from 'data/BrowserLocationContext';
import { InstanceInfo } from 'bindings/InstanceInfo';

function DraggableInstancePill({ instance }: { instance: InstanceInfo }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: instance.uuid,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <InstancePill {...instance} />
    </div>
  );
}

function InstanceListInner({
  className = '',
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const gaEventTracker = useAnalyticsEventTracker('Instance List');
  const {
    instanceList: instances,
    selectedInstance,
    selectInstance,
    isReady,
  } = useContext(InstanceContext);
  const { ongoingNotifications } = useContext(NotificationContext);
  const userLoggedIn = useUserLoggedIn();
  const {
    location: { pathname },
  } = useContext(BrowserLocationContext);

  const { folders, createFolder, moveToFolder, getFolderForInstance } = useFolders();

  const [activeInstance, setActiveInstance] = useState<InstanceInfo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    if (!isReady) return;
    gaEventTracker('View', 'Instance List', true, Object.keys(instances).length);
  }, [isReady, instances]);

  useEffect(() => {
    if (pathname == '/') {
      selectInstance(null);
    }
  }, [pathname]);

  function handleDragStart(event: { active: { id: string | number } }) {
    const inst = instances?.[event.active.id as string];
    if (inst) setActiveInstance(inst);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveInstance(null);
    const { active, over } = event;
    if (!over) return;
    const instanceUuid = active.id as string;
    const folderId = over.id as string;
    if (folders[folderId]) {
      moveToFolder(instanceUuid, folderId);
    }
  }

  const ungroupedInstances = instances
    ? Object.values(instances).filter(
        (i) => !getFolderForInstance(i.uuid)
      )
    : [];

  const hasFolders = Object.keys(folders).length > 0;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <RadioGroup
        className={`mx-1 flex min-h-0 flex-col gap-y-1 overflow-y-auto px-1 child:w-full ${className}`}
        value={selectedInstance}
        onChange={selectInstance}
      >
        {userLoggedIn ? (
          <>
            {/* Ungrouped instances */}
            {(!hasFolders || ungroupedInstances.length > 0) && (
              <RadioGroup.Label className="text-small font-bold leading-snug text-gray-faded/30">
                {hasFolders ? 'OHNE ORDNER' : 'ALL INSTANCES'}
              </RadioGroup.Label>
            )}
            {ungroupedInstances.map((instance) => (
              <RadioGroup.Option
                key={instance.uuid}
                value={instance}
                className="rounded-md outline-none child:w-full"
              >
                <DraggableInstancePill instance={instance} />
              </RadioGroup.Option>
            ))}

            {/* Folders */}
            {Object.values(folders).map((folder) => (
              <FolderItem key={folder.id} folder={folder} />
            ))}

            {/* Add folder button */}
            <button
              onClick={() => {
                const name = window.prompt('Ordner-Name:');
                if (name?.trim()) createFolder(name.trim());
              }}
              className="mt-1 flex items-center gap-x-1.5 rounded-md px-2 py-1 text-small text-gray-faded/30 hover:text-gray-400 hover:bg-gray-700/30 transition-colors"
            >
              <FontAwesomeIcon icon={faFolderPlus} className="text-xs" />
              <span>Ordner erstellen</span>
            </button>
          </>
        ) : (
          <div
            className={`mt-2 flex w-fit select-none flex-col items-stretch gap-4 rounded-xl border-2 border-dashed border-gray-faded/10 py-4 px-6 text-medium font-bold tracking-tight`}
          >
            <FontAwesomeIcon
              icon={faExpand}
              className="text-h1 text-gray-faded/30"
            />
            <p className="text-center text-medium italic text-gray-faded/30">
              Log in to view your server instances.
            </p>
          </div>
        )}
        {ongoingNotifications &&
          ongoingNotifications
            .map((notification) => {
              if (!notification.start_value) return null;
              if (notification.state === 'done') return null;
              return match(
                notification.start_value,
                otherwise(
                  {
                    InstanceCreation: ({ instance_uuid }) => (
                      <InstanceLoadingPill
                        key={instance_uuid}
                        progress_percent={
                          notification.total
                            ? notification.progress / notification.total
                            : undefined
                        }
                      />
                    ),
                  },
                  (_) => null
                )
              );
            })
            .reverse()}
        {children}
      </RadioGroup>

      <DragOverlay>
        {activeInstance ? <InstancePill {...activeInstance} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

export default function InstanceList({
  className = '',
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <FolderProvider>
      <InstanceListInner className={className}>{children}</InstanceListInner>
    </FolderProvider>
  );
}
