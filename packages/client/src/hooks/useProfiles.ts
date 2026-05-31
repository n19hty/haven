import { useState } from "react";
import { CharacterConfig, DEFAULT_CHARACTER } from "../components/Character";

export interface Profile {
  id: string;
  name: string;
  color: string;
  character: CharacterConfig;
}

const COLORS = ["#A78BFA","#F59E0B","#34D399","#FB7185","#60A5FA","#EC4899","#FBBF24"];
const KEY    = "haven-profiles";

function load(): Profile[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); }
  catch { return []; }
}
function save(p: Profile[]) { localStorage.setItem(KEY, JSON.stringify(p)); }

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>(load);

  function addProfile(name: string, character: CharacterConfig): Profile {
    const existing = load();
    const p: Profile = {
      id: Math.random().toString(36).slice(2, 10),
      name: name.trim(),
      color: COLORS[existing.length % COLORS.length],
      character,
    };
    const next = [...existing, p];
    save(next); setProfiles(next);
    return p;
  }

  function updateProfile(id: string, updates: Partial<Pick<Profile,"name"|"character">>) {
    const next = load().map((p) => p.id === id ? { ...p, ...updates } : p);
    save(next); setProfiles(next);
  }

  function removeProfile(id: string) {
    const next = load().filter((p) => p.id !== id);
    save(next); setProfiles(next);
  }

  return { profiles, addProfile, updateProfile, removeProfile };
}
