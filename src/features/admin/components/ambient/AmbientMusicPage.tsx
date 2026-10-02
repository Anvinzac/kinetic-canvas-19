/**
 * Admin page for managing ambient background music tracks.
 * Lists all tracks from the DB, allows adding new MP3 URLs and deleting.
 *
 * Exports: AmbientMusicPage
 * Depends on: @tanstack/react-query, ../api/ambient.functions
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addAmbientTrack,
  deleteAmbientTrack,
  listAmbientTracks,
  type AmbientTrack,
} from "../../api/ambient.functions";
import { Music, Plus, Trash2, ExternalLink } from "lucide-react";

export function AmbientMusicPage() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [bpm, setBpm] = useState("120");
  const [error, setError] = useState<string | null>(null);

  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["admin", "ambient-tracks"],
    queryFn: () => listAmbientTracks(),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      addAmbientTrack({ data: { url: url.trim(), name: name.trim(), bpm: Number(bpm) || 120 } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ambient-tracks"] });
      setUrl("");
      setName("");
      setBpm("120");
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAmbientTrack({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ambient-tracks"] });
    },
    onError: (err) => setError(err.message),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!url.trim()) {
      setError("URL is required");
      return;
    }
    try {
      new URL(url.trim());
    } catch {
      setError("Invalid URL format");
      return;
    }
    addMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Music className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">Ambient Music</h1>
          <p className="text-sm text-muted-foreground">
            Direct MP3 links streamed as background music in the vocabulary feed.
          </p>
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Add Track
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_200px_80px_auto]">
          <input
            type="url"
            placeholder="https://cdn.example.com/track.mp3"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
            required
          />
          <input
            type="text"
            placeholder="Track name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="BPM"
            min={40}
            max={300}
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {/* Track list */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Tracks ({tracks.length})
          </h2>
        </div>
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : tracks.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No tracks yet. Add your first MP3 link above.
          </p>
        ) : (
          <ul className="divide-y">
            {tracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                onDelete={() => deleteMutation.mutate(track.id)}
                deleting={deleteMutation.isPending}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TrackRow({
  track,
  onDelete,
  deleting,
}: {
  track: AmbientTrack;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium">
          {track.name || track.url.split("/").pop() || "Untitled"}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{track.url}</span>
      </span>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{track.bpm} BPM</span>
      <a
        href={track.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Open track URL"
      >
        <ExternalLink size={14} />
      </a>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
        aria-label={`Delete ${track.name || "track"}`}
      >
        <Trash2 size={15} />
      </button>
    </li>
  );
}
