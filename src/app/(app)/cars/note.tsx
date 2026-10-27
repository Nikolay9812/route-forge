import { useLocalSearchParams } from "expo-router";

import { NoteScreen } from "@/components/car-notes/note-screen";

// One service log note, for the mechanic.
export default function Note() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <NoteScreen id={id} stack="cars" />;
}
