/**
 * One editable Vietnamese field of a workbench row, with its flag-and-rewrite menu.
 *
 * The two live together because they are the same decision from opposite ends: fix the
 * sentence yourself, or say what is wrong with it and have the model try again.
 *
 * Exports: WorkbenchTextCell
 * Depends on: EditableCell, FlagRegenerateMenu
 */

import { EditableCell } from "./EditableCell";
import { FlagRegenerateMenu } from "./FlagRegenerateMenu";

/**
 * Editable card-text cell.
 * @param props.word - the English word, used for the menu's accessible label
 * @param props.label - what this field is called in the UI ("definition", "lead", …)
 * @returns text cell UI
 */
export function WorkbenchTextCell({
  value,
  word,
  label,
  multiline,
  onSave,
  onRegenerate,
}: {
  value: string;
  word: string;
  label: string;
  multiline?: boolean;
  onSave: (value: string) => void;
  onRegenerate: (complaints: string[]) => Promise<unknown>;
}): React.ReactElement {
  return (
    <td className="relative px-2 py-2">
      <FlagRegenerateMenu label={`${label} of ${word}`} onRegenerate={onRegenerate} />
      <EditableCell
        value={value}
        onSave={onSave}
        multiline={multiline}
        className="pb-6"
        placeholder={label}
      />
    </td>
  );
}
