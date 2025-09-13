"use client"

export type Playlist = { id: string; name: string; createdAt: string; updatedAt: string }
export type PlaylistItem = { id: string; title: string; url: string; addedBy?: string; thumbnailUrl?: string; position: number }

export async function listPlaylists() {
  const res = await fetch('/api/playlists', { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load playlists')
  const j = await res.json()
  return j.playlists as Playlist[]
}

export async function createPlaylist(name: string) {
  const res = await fetch('/api/playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
  if (!res.ok) throw new Error('Failed to create playlist')
  const j = await res.json()
  return j.playlist as Playlist
}

export async function getPlaylist(id: string) {
  const res = await fetch(`/api/playlists/${id}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Playlist not found')
  const j = await res.json()
  return j.playlist as Playlist & { items: PlaylistItem[] }
}

export async function renamePlaylist(id: string, name: string) {
  const res = await fetch(`/api/playlists/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
  if (!res.ok) throw new Error('Failed to rename')
  const j = await res.json()
  return j.playlist as Playlist
}

export async function deletePlaylist(id: string) {
  const res = await fetch(`/api/playlists/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete')
}

export async function addItemToPlaylist(id: string, item: { title: string; url: string; addedBy?: string; thumbnailUrl?: string }) {
  const res = await fetch(`/api/playlists/${id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
  if (!res.ok) throw new Error('Failed to add item')
  const j = await res.json()
  return j.item as PlaylistItem
}

export async function removeItemFromPlaylist(id: string, itemId: string) {
  const res = await fetch(`/api/playlists/${id}/items?itemId=${encodeURIComponent(itemId)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to remove item')
}
