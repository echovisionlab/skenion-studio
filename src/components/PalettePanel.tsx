import { useMemo } from "react";
import { Badge, Divider, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { Plus } from "lucide-react";
import { type NodeCatalogEntryV01 } from "@skenion/contracts";
import { dataTypeFromPortSpec } from "../graph/patchLibrary";
import { flowColor } from "../graph/reactFlowAdapter";
import { Button } from "./core/Button/Button";

interface PalettePanelProps {
  addDisabled?: boolean;
  catalogEntries?: NodeCatalogEntryV01[];
  onAddObject: () => boolean | Promise<boolean | void> | void;
  onAddObjectSpec: (objectSpec: string) => boolean | Promise<boolean | void> | void;
}

export function PalettePanel({
  addDisabled = false,
  catalogEntries = [],
  onAddObject,
  onAddObjectSpec
}: PalettePanelProps) {
  const catalogMode = catalogEntries.length > 0;
  const nodeTools = useMemo(() => resolveNodeTools(catalogEntries), [catalogEntries]);

  return (
    <Stack className="panel-shell" gap="md">
      <div>
        <Text fw={800} size="sm">
          Nodes
        </Text>
        <Text c="dimmed" size="xs">
          {catalogMode
            ? `${nodeTools.length} available tools`
            : "Runtime catalog unavailable"}
        </Text>
      </div>

      <Button
        disabled={addDisabled}
        fullWidth
        leftSection={<Plus size={15} />}
        onClick={() => onAddObject()}
        size="compact-md"
      >
        Object
      </Button>

      <Divider />

      <ScrollArea className="palette-scroll" offsetScrollbars>
        {catalogMode ? (
          <Stack gap="xs">
            <Group justify="space-between">
              <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                Node tools
              </Text>
              <Badge size="xs" variant="light">
                {nodeTools.length}
              </Badge>
            </Group>
            {nodeTools.map(({ entry, tool }) => {
              const primaryPort = entry.definition.ports.find((port) => port.direction === "output") ?? entry.definition.ports[0];
              const primaryType = primaryPort ? dataTypeFromPortSpec(primaryPort) : null;
              const swatchColor = primaryType ? flowColor(primaryType.flow, primaryType.dataKind) : "#868e96";
              const primaryObjectSpec = objectSpecForCatalogEntry(entry);

              return (
                <Group gap={6} key={entry.catalogId} wrap="nowrap">
                  <Button
                    className="palette-node"
                    color="gray"
                    disabled={addDisabled}
                    fullWidth
                    justify="space-between"
                    leftSection={<span className="flow-swatch" style={{ background: swatchColor }} />}
                    onClick={() => onAddObjectSpec(primaryObjectSpec)}
                    rightSection={<Plus size={15} />}
                    size="compact-md"
                  >
                    <span>
                      <Text component="span" fw={700} size="sm">
                        {tool.label}
                      </Text>
                      <Text c="dimmed" component="span" display="block" size="xs">
                        {primaryObjectSpec}
                      </Text>
                    </span>
                  </Button>
                </Group>
              );
            })}
          </Stack>
        ) : (
          <Text c="dimmed" size="xs">
            Runtime catalog unavailable.
          </Text>
        )}
      </ScrollArea>
    </Stack>
  );
}

interface NodeToolDefinition {
  key: string;
  label: string;
  match: string[];
}

const NODE_TOOL_DEFINITIONS: NodeToolDefinition[] = [
  { key: "bang", label: "Bang", match: ["bang", "b", "core.bang"] },
  { key: "toggle", label: "Toggle", match: ["toggle", "tgl", "core.toggle"] },
  { key: "message", label: "Message", match: ["message", "msg", "core.message"] },
  { key: "float", label: "Float", match: ["float", "f", "core.float"] },
  { key: "int", label: "Integer", match: ["int", "integer", "i", "core.int"] },
  { key: "uint", label: "Unsigned Integer", match: ["uint", "unsigned integer", "u", "core.uint"] },
  { key: "comment", label: "Comment", match: ["comment", "core.comment"] },
  { key: "inlet", label: "Inlet", match: ["inlet", "core.inlet"] },
  { key: "outlet", label: "Outlet", match: ["outlet", "core.outlet"] }
];

interface ResolvedNodeTool {
  entry: NodeCatalogEntryV01;
  tool: NodeToolDefinition;
}

function resolveNodeTools(entries: NodeCatalogEntryV01[]): ResolvedNodeTool[] {
  return NODE_TOOL_DEFINITIONS.flatMap((tool) => {
    const entry = entries.find((candidate) => catalogEntryMatchesTool(candidate, tool));
    return entry ? [{ entry, tool }] : [];
  });
}

function catalogEntryMatchesTool(entry: NodeCatalogEntryV01, tool: NodeToolDefinition): boolean {
  const accepted = new Set(tool.match.map(normalizedSpec));
  return catalogEntryLookupValues(entry).some((value) => accepted.has(normalizedSpec(value)));
}

function catalogEntryLookupValues(entry: NodeCatalogEntryV01): string[] {
  return [
    entry.catalogId,
    entry.objectId,
    entry.definition.id,
    entry.definition.displayName,
    entry.display.title,
    ...catalogEntrySpecs(entry)
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
}

function catalogEntrySpecs(entry: NodeCatalogEntryV01): string[] {
  return [entry.primaryObjectSpec, ...(entry.aliases ?? [])];
}

function objectSpecForCatalogEntry(entry: NodeCatalogEntryV01): string {
  return entry.primaryObjectSpec;
}

function normalizedSpec(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/gu, " ");
}
