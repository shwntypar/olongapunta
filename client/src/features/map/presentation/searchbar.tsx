import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { loadingAreas } from "../domain/loadingArea"

export function SearchBar() {
  return (
    <Field orientation="horizontal">
      <Input className="bg-slate-200" type="search" placeholder="Search..." />
      <Button>Search</Button>
    </Field>
  )
}