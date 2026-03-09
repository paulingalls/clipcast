import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AspectRatio } from "@/utils/validation";

export interface HarnessData {
  phrases: string;
  title: string;
  duration: number;
  background: string;
  text: string;
  accent: string;
  aspectRatio: AspectRatio;
}

interface DataPanelProps {
  data: HarnessData;
  onChange: (data: HarnessData) => void;
  onReload: () => void;
}

export function DataPanel({ data, onChange, onReload }: DataPanelProps) {
  const update = (patch: Partial<HarnessData>) => {
    onChange({ ...data, ...patch });
  };

  return (
    <div className="flex flex-col gap-3 bg-card p-4 rounded-lg border border-border">
      <div className="space-y-1.5">
        <Label htmlFor="phrases">Phrases (one per line)</Label>
        <Textarea
          id="phrases"
          value={data.phrases}
          onChange={(e) => {
            update({ phrases: e.target.value });
          }}
          rows={5}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={data.title}
          onChange={(e) => {
            update({ title: e.target.value });
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="duration">Duration (seconds)</Label>
        <Input
          id="duration"
          type="number"
          min={3}
          max={30}
          value={data.duration}
          onChange={(e) => {
            update({ duration: Number(e.target.value) });
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Aspect Ratio</Label>
        <Select
          value={data.aspectRatio}
          onValueChange={(v) => {
            update({ aspectRatio: v as HarnessData["aspectRatio"] });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
            <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
            <SelectItem value="1:1">1:1 (Square)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ColorField
          label="BG"
          value={data.background}
          onChange={(v) => {
            update({ background: v });
          }}
        />
        <ColorField
          label="Text"
          value={data.text}
          onChange={(v) => {
            update({ text: v });
          }}
        />
        <ColorField
          label="Accent"
          value={data.accent}
          onChange={(v) => {
            update({ accent: v });
          }}
        />
      </div>

      <Button onClick={onReload} className="w-full">
        Reload
      </Button>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className="h-8 w-8 rounded border border-border cursor-pointer shrink-0"
        />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className="font-mono text-xs h-8 px-1.5"
        />
      </div>
    </div>
  );
}
