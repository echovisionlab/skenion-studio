import {
  FileButton,
  Group,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme
} from "@mantine/core";
import {
  Download,
  FolderOpen,
  Moon,
  Save,
  Settings,
  Sun,
  Upload
} from "lucide-react";
import { IconButton } from "./core/IconButton/IconButton";
import { SkenionMark } from "./brand/SkenionMark";

interface StudioToolbarProps {
  projectName: string;
  runtimeGraphAvailable: boolean;
  onExport: () => void;
  onImport: (file: File | null) => void;
  onOpenProject: (file: File | null) => void;
  onSaveProject: () => void;
  onOpenSettings: () => void;
}

export function StudioToolbar({
  projectName,
  runtimeGraphAvailable,
  onExport,
  onImport,
  onOpenProject,
  onSaveProject,
  onOpenSettings
}: StudioToolbarProps) {
  const graphActionDisabled = !runtimeGraphAvailable;
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: false });
  const nextColorScheme = computedColorScheme === "dark" ? "light" : "dark";
  const colorSchemeLabel = nextColorScheme === "dark" ? "Dark Mode" : "Light Mode";

  return (
    <Group className="studio-toolbar" justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        <SkenionMark />
        <Text fw={800} size="sm" truncate>
          skenion studio
        </Text>
        <Text c="dimmed" size="xs" truncate>
          {projectName}
        </Text>
      </Group>

      <Group gap="xs" wrap="nowrap">
        <Tooltip label="Open project (.skenion.json)">
          <FileButton accept=".skenion.json,application/json,.json" onChange={onOpenProject}>
            {(props) => (
              <IconButton
                disabled={graphActionDisabled}
                icon={<FolderOpen size={15} />}
                label="Open project"
                size={28}
                {...props}
              />
            )}
          </FileButton>
        </Tooltip>
        <Tooltip label="Save project (.skenion.json)">
          <IconButton
            disabled={graphActionDisabled}
            icon={<Save size={15} />}
            label="Save project"
            onClick={onSaveProject}
            size={28}
          />
        </Tooltip>
        <Tooltip label="Import graph JSON">
          <FileButton accept="application/json,.json" onChange={onImport}>
            {(props) => (
              <IconButton
                disabled={graphActionDisabled}
                icon={<Upload size={15} />}
                label="Import graph JSON"
                size={28}
                {...props}
              />
            )}
          </FileButton>
        </Tooltip>
        <Tooltip label="Export graph JSON">
          <IconButton
            disabled={graphActionDisabled}
            icon={<Download size={15} />}
            label="Export graph JSON"
            onClick={onExport}
            size={28}
          />
        </Tooltip>
        <Tooltip label="Open Settings">
          <IconButton
            color="blue"
            icon={<Settings size={15} />}
            label="Open Settings"
            onClick={onOpenSettings}
            size={28}
          />
        </Tooltip>
        <Tooltip label={colorSchemeLabel}>
          <IconButton
            color="blue"
            icon={nextColorScheme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
            label={colorSchemeLabel}
            onClick={() => setColorScheme(nextColorScheme)}
            size={28}
          />
        </Tooltip>
      </Group>
    </Group>
  );
}
