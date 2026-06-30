import { useMemo, useState, type FormEvent } from "react";
import { Badge, Divider, Group, ScrollArea, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { HelpCircle, Plus } from "lucide-react";
import { type NodeCatalogEntryV01 } from "@skenion/contracts";
import { objectSpecForCatalogEntry } from "@skenion/sdk";
import { dataTypeFromPortSpec } from "../graph/patchLibrary";
import { flowColor } from "../graph/reactFlowAdapter";
import { Button } from "./core/Button/Button";
import { IconButton } from "./core/IconButton/IconButton";

interface PalettePanelProps {
  addDisabled?: boolean;
  catalogEntries?: NodeCatalogEntryV01[];
  onAddObjectText: (objectText: string) => boolean | Promise<boolean | void> | void;
  onShowHelp: (definitionId: string) => void;
}

export function PalettePanel({
  addDisabled = false,
  catalogEntries = [],
  onAddObjectText,
  onShowHelp
}: PalettePanelProps) {
  const [objectText, setObjectText] = useState("");
  const objectTextInput = objectText.trim();
  const catalogMode = catalogEntries.length > 0;
  const filteredCatalogEntries = useMemo(
    () => filterCatalogEntries(catalogEntries, objectTextInput),
    [catalogEntries, objectTextInput]
  );
  const objectTextCanCreate = objectTextInput.length > 0 && !addDisabled;
  const exactCatalogMatches = objectTextInput
    ? catalogEntries.filter((entry) => catalogEntrySpecs(entry).some((spec) => normalizedSpec(spec) === normalizedSpec(objectTextInput)))
    : [];
  const objectTextBadge = objectTextInput
    ? exactCatalogMatches.length === 1
      ? "catalog match"
      : exactCatalogMatches.length > 1
        ? "ambiguous"
        : "runtime resolve"
    : null;

  async function submitObjectText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!objectTextCanCreate) {
      return;
    }
    const result = await onAddObjectText(objectTextInput);
    if (result !== false) {
      setObjectText("");
    }
  }

  return (
    <Stack className="panel-shell" gap="md">
      <div>
        <Text fw={800} size="sm">
          Objects
        </Text>
        <Text c="dimmed" size="xs">
          {catalogMode
            ? `${catalogEntries.length} Runtime catalog`
            : "Runtime catalog unavailable"}
        </Text>
      </div>

      <form onSubmit={submitObjectText}>
        <Stack gap={6}>
          <Group justify="space-between">
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              Object Box
            </Text>
            {objectTextBadge ? (
              <Badge size="xs" variant="light">
                {objectTextBadge}
              </Badge>
            ) : null}
          </Group>
          <TextInput
            aria-label="Object box text"
            disabled={addDisabled}
            onChange={(event) => setObjectText(event.currentTarget.value)}
            placeholder="+ 1, +~, osc~ 440"
            size="xs"
            value={objectText}
          />
          {exactCatalogMatches.length > 1 ? (
            <Text c="dimmed" size="xs">
              Runtime will keep this text and return candidates.
            </Text>
          ) : null}
          <Button disabled={!objectTextCanCreate} fullWidth size="compact-sm" type="submit">
            Create Object
          </Button>
        </Stack>
      </form>

      <Divider />

      <ScrollArea className="palette-scroll" offsetScrollbars>
        {catalogMode ? (
          <Stack gap="xs">
            <Group justify="space-between">
              <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                Catalog
              </Text>
              <Badge size="xs" variant="light">
                {filteredCatalogEntries.length}
              </Badge>
            </Group>
            {filteredCatalogEntries.map((entry) => {
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
                    onClick={() => onAddObjectText(primaryObjectSpec)}
                    rightSection={<Plus size={15} />}
                    size="compact-md"
                  >
                    <span>
                      <Text component="span" fw={700} size="sm">
                        {primaryObjectSpec}
                      </Text>
                      <Text c="dimmed" component="span" display="block" size="xs">
                        {entry.display.title}
                      </Text>
                    </span>
                  </Button>
                  <Tooltip label={`Help: ${entry.display.title}`}>
                    <IconButton
                      icon={<HelpCircle size={16} />}
                      label={`Show help for ${entry.display.title}`}
                      onClick={() => onShowHelp(entry.definition.id)}
                      size={34}
                    />
                  </Tooltip>
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

function filterCatalogEntries(entries: NodeCatalogEntryV01[], query: string): NodeCatalogEntryV01[] {
  const normalizedQuery = normalizedSpec(query);
  if (!normalizedQuery) {
    return entries;
  }
  return entries.filter((entry) => {
    const haystack = [
      entry.display.title,
      entry.display.category,
      entry.display.description,
      ...catalogEntrySpecs(entry)
    ]
      .filter((value): value is string => typeof value === "string")
      .map(normalizedSpec);
    return haystack.some((value) => value.includes(normalizedQuery));
  });
}

function catalogEntrySpecs(entry: NodeCatalogEntryV01): string[] {
  return [entry.primaryObjectSpec, ...(entry.aliases ?? [])];
}

function normalizedSpec(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/gu, " ");
}
