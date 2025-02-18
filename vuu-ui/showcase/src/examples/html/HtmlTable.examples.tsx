import { useTableConfig } from "../utils";
import {
  DivElementKeyedWithTranslate,
  DivElementKeyedWithTranslateInlineScrollbars,
  DivElementKeyedWithTranslateInlineScrollbarsCssVariables,
  DivElementWithSizers,
  DivElementWithTranslate,
  TableElementWithSizers,
} from "./html-table-components";

import { RowProps } from "@finos/vuu-table/src/TableRow";

let displaySequence = 1;

const bufferCount = 5;
const rowHeight = 30;
const headerHeight = 30;
const viewportHeight = 700;
const visibleRowCount = 20;

export type ComponentTypeNoChildren<T = unknown> = (props: T) => JSX.Element;
export type RowType = ComponentTypeNoChildren<RowProps>;

export const DefaultTableElementWithSizers = () => {
  const config = useTableConfig({
    columnCount: 10,
    count: 1000,
    rangeChangeRowset: "full",
  });
  return (
    <TableElementWithSizers
      {...config}
      headerHeight={30}
      height={645}
      renderBufferSize={0}
      rowHeight={30}
      width={715}
    />
  );
};
DefaultTableElementWithSizers.displaySequence = displaySequence++;

export const DefaultDivElementWithSizers = () => {
  const config = useTableConfig({
    columnCount: 10,
    count: 1000,
    rangeChangeRowset: "full",
  });

  return (
    <DivElementWithSizers
      {...config}
      headerHeight={30}
      height={645}
      renderBufferSize={0}
      rowHeight={30}
      width={715}
    />
  );
};
DefaultDivElementWithSizers.displaySequence = displaySequence++;

export const DefaultDivElementWithTranslate = () => {
  const config = useTableConfig({
    columnCount: 10,
    count: 1000,
    rangeChangeRowset: "full",
  });

  return (
    <DivElementWithTranslate
      {...config}
      headerHeight={30}
      height={645}
      renderBufferSize={0}
      rowHeight={30}
      width={715}
    />
  );
};
DefaultDivElementWithTranslate.displaySequence = displaySequence++;

export const DefaultDivElementKeyedWithTranslate = () => {
  const config = useTableConfig({
    columnCount: 10,
    count: 1000,
    rangeChangeRowset: "full",
  });

  return (
    <DivElementKeyedWithTranslate
      {...config}
      headerHeight={30}
      height={645}
      renderBufferSize={0}
      rowHeight={30}
      width={715}
    />
  );
};
DefaultDivElementKeyedWithTranslate.displaySequence = displaySequence++;

export const DefaultDivElementKeyedWithTranslateInlineScrollbars = () => {
  const config = useTableConfig({
    columnCount: 10,
    count: 1000,
    rangeChangeRowset: "full",
  });

  return (
    <DivElementKeyedWithTranslateInlineScrollbars
      {...config}
      headerHeight={30}
      height={645}
      renderBufferSize={0}
      rowHeight={30}
      width={715}
    />
  );
};
DefaultDivElementKeyedWithTranslateInlineScrollbars.displaySequence =
  displaySequence++;

export const DefaultDivElementKeyedWithTranslateInlineScrollbarsCssVariables =
  () => {
    const config = useTableConfig({
      columnCount: 10,
      count: 1000,
      rangeChangeRowset: "full",
    });

    return (
      <DivElementKeyedWithTranslateInlineScrollbarsCssVariables
        {...config}
        headerHeight={30}
        height={645}
        renderBufferSize={0}
        rowHeight={30}
        width={715}
      />
    );
  };
DefaultDivElementKeyedWithTranslateInlineScrollbarsCssVariables.displaySequence =
  displaySequence++;
