import { useMemo, useState, type FormEvent } from "react";
import { Badge, Divider, Group, ScrollArea, Stack, Text, TextInput } from "@mantine/core";
import { Plus } from "lucide-react";
import { type NodeCatalogEntryV01 } from "@skenion/contracts";
import { objectSpecForCatalogEntry } from "@skenion/sdk";
import { dataTypeFromPortSpec } from "../graph/patchLibrary";
import { flowColor } from "../graph/reactFlowAdapter";
import { Button } from "./core/Button/Button";

interface PalettePanelProps {
  addDisabled?: boolean;
  catalogEntries?: NodeCatalogEntryV01[];
  onAddObjectSpec: (objectSpec: string) => boolean | Promise<boolean | void> | void;
}

export function PalettePanel({
  addDisabled = false,
  catalogEntries = [],
  onAddObjectSpec
}: PalettePanelProps) {
  const [objectSpec, setObjectSpec] = useState("");
  const objectSpecInput = objectSpec.trim();
  const catalogMode = catalogEntries.length > 0;
  const filteredCatalogEntries = useMemo(
    () => filterCatalogEntries(catalogEntries, objectSpecInput),
    [catalogEntries, objectSpecInput]
  );
  const objectSpecCanCreate = objectSpecInput.length > 0 && !addDisabled;
  const exactCatalogMatches = objectSpecInput
    ? catalogEntries.filter((entry) => catalogEntrySpecs(entry).some((spec) => normalizedSpec(spec) === normalizedSpec(objectSpecInput)))
    : [];
  const objectSpecBadge = objectSpecInput
    ? exactCatalogMatches.length === 1
      ? "catalog match"
      : exactCatalogMatches.length > 1
        ? "ambiguous"
        : "runtime resolve"
    : null;

  async function submitObjectSpec(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!objectSpecCanCreate) {
      return;
    }
    const result = await onAddObjectSpec(objectSpecInput);
    if (result !== false) {
      setObjectSpec("");
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

      <form onSubmit={submitObjectSpec}>
        <Stack gap={6}>
          <Group justify="space-between">
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              Object
            </Text>
            {objectSpecBadge ? (
              <Badge size="xs" variant="light">
                {objectSpecBadge}
              </Badge>
            ) : null}
          </Group>
          <TextInput
            aria-label="Object spec"
            disabled={addDisabled}
            onChange={(event) => setObjectSpec(event.currentTarget.value)}
            placeholder="+ 1, +~, osc~ 440"
            size="xs"
            value={objectSpec}
          />
          {exactCatalogMatches.length > 1 ? (
            <Text c="dimmed" size="xs">
              Runtime will keep this text and return candidates.
            </Text>
          ) : null}
          <Button disabled={!objectSpecCanCreate} fullWidth size="compact-sm" type="submit">
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
                    onClick={() => onAddObjectSpec(primaryObjectSpec)}
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
