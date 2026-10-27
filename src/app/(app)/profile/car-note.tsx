import { useLocalSearchParams } from "expo-router";

import { NoteScreen } from "@/components/car-notes/note-screen";

// One service log note, for the owner.
export default function CarNote() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <NoteScreen id={id} stack="profile" />;
}
