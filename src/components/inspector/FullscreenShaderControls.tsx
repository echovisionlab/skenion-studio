import { Alert, Badge, Button, Code, Group, Stack, Text, Textarea } from "@mantine/core";
import { RotateCcw, ScanSearch, Waypoints } from "lucide-react";
import { useState } from "react";
import type { ShaderInterfaceAnalysisV01 } from "@skenion/contracts";

export interface FullscreenShaderControlsProps {
  analysis: ShaderInterfaceAnalysisV01;
  interfaceSynced: boolean;
  language: string;
  source: string;
  onAnalyze: () => void;
  onSourceChange: (source: string) => void;
  onResetSource: () => void;
  onSyncInputs: () => void;
}

export function FullscreenShaderControls({
  analysis,
  interfaceSynced,
  language,
  onAnalyze,
  onResetSource,
  onSourceChange,
  onSyncInputs,
  source
}: FullscreenShaderControlsProps) {
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const uniforms = analysis.shaderInterface.uniforms;
  const hasErrors = analysis.diagnostics.some((diagnostic) => diagnostic.severity === "error");

  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text c="dimmed" fw={700} size="xs" tt="uppercase">
            Fullscreen Shader
          </Text>
          <Group gap={6} mt={4}>
            <Text c="dimmed" size="xs">
              Language
            </Text>
            <Badge radius="sm" variant="light">
              {language}
            </Badge>
            <Badge color={hasErrors ? "red" : "green"} radius="sm" variant="light">
              {hasErrors ? "analysis error" : "analysis ok"}
            </Badge>
            <Badge color={interfaceSynced ? "green" : "yellow"} radius="sm" variant="light">
              {interfaceSynced ? "inputs synced" : "sync needed"}
            </Badge>
          </Group>
          <Text c="dimmed" mt={4} size="xs">
            Uniforms: {uniforms.length > 0 ? uniforms.map((uniform) => uniform.id).join(", ") : "none"}
          </Text>
        </div>
        <Group gap={6} wrap="nowrap">
          <Button
            leftSection={<ScanSearch size={14} />}
            onClick={() => {
              setAnalysisVisible(true);
              onAnalyze();
            }}
            radius="sm"
            size="compact-sm"
            variant="light"
          >
            Analyze
          </Button>
          <Button
            disabled={hasErrors || interfaceSynced}
            leftSection={<Waypoints size={14} />}
            onClick={onSyncInputs}
            radius="sm"
            size="compact-sm"
            variant="filled"
          >
            Sync Inputs
          </Button>
          <Button
            leftSection={<RotateCcw size={14} />}
            onClick={onResetSource}
            radius="sm"
            size="compact-sm"
            variant="light"
          >
            Reset
          </Button>
        </Group>
      </Group>

      {analysisVisible || hasErrors || !interfaceSynced ? (
        <Alert color={hasErrors ? "red" : interfaceSynced ? "gray" : "yellow"} radius="sm" variant="light">
          <Stack gap={6}>
            {uniforms.length > 0 ? (
              <Stack gap={3}>
                {uniforms.map((uniform) => (
                  <Text key={uniform.id} size="xs">
                    <Code>{uniform.id}</Code> {uniform.type.dataKind}
                  </Text>
                ))}
              </Stack>
            ) : (
              <Text size="xs">No dynamic input uniforms were found. The node will only expose render output.</Text>
            )}
            {analysis.diagnostics.map((diagnostic) => (
              <Text key={`${diagnostic.code}:${diagnostic.line ?? "global"}:${diagnostic.uniformId ?? ""}`} size="xs">
                {diagnostic.code}: {diagnostic.message}
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}

      <Textarea
        autosize
        label="WGSL Source"
        maxRows={22}
        minRows={12}
        onChange={(event) => onSourceChange(event.currentTarget.value)}
        size="xs"
        spellCheck={false}
        styles={{
          input: {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          }
        }}
        value={source}
      />
    </Stack>
  );
}
