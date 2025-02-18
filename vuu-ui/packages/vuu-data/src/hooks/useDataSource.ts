// TODO is this hook needed ? it is currently used only in a vuu salt story
import { VuuRange } from "@finos/vuu-protocol-types";
import { getFullRange, metadataKeys, WindowRange } from "@finos/vuu-utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataSource, DataSourceRow, SubscribeCallback } from "../data-source";

const { SELECTED } = metadataKeys;

export interface DataSourceHookProps {
  dataSource: DataSource;
  renderBufferSize?: number;
}

export function useDataSource({
  dataSource,
  renderBufferSize = 10,
}: DataSourceHookProps): [
  DataSourceRow[],
  number,
  VuuRange,
  (range: VuuRange) => void
] {
  const [, forceUpdate] = useState<object | null>(null);
  const isMounted = useRef(true);
  const hasUpdated = useRef(false);
  const rafHandle = useRef(null);
  const data = useRef<DataSourceRow[]>([]);
  const rangeRef = useRef({ from: 0, to: 10 });

  const dataWindow = useMemo(
    () => new MovingWindow(getFullRange(rangeRef.current, renderBufferSize)),
    [renderBufferSize]
  );

  const setData = useCallback(
    (updates: DataSourceRow[]) => {
      for (const row of updates) {
        dataWindow.add(row);
      }
      // Why bother with the slice ?
      data.current = dataWindow.data.slice();

      hasUpdated.current = true;
    },
    [dataWindow]
  );

  const datasourceMessageHandler: SubscribeCallback = useCallback(
    (message) => {
      if (message.type === "viewport-update") {
        if (message.size !== undefined) {
          dataWindow.setRowCount(message.size);
        }
        if (message.rows) {
          setData(message.rows);
          forceUpdate({});
        } else if (message.size !== undefined) {
          // TODO is this right ?
          data.current = dataWindow.data.slice();
          hasUpdated.current = true;
        }
      }
    },
    [dataWindow, setData]
  );

  useEffect(
    () => () => {
      if (rafHandle.current) {
        cancelAnimationFrame(rafHandle.current);
        rafHandle.current = null;
      }
      isMounted.current = false;
    },
    []
  );

  const setRange = useCallback(
    (range) => {
      rangeRef.current = range;
      const fullRange = getFullRange(rangeRef.current, renderBufferSize);
      dataSource.range = fullRange;
      dataWindow.setRange(fullRange.from, fullRange.to);
    },
    [dataSource, dataWindow, renderBufferSize]
  );

  useMemo(() => {
    const { from, to } = rangeRef.current;
    const fullRange = getFullRange({ from, to }, renderBufferSize);
    dataSource.range = fullRange;
    dataWindow.setRange(fullRange.from, fullRange.to);
  }, [dataSource, dataWindow, renderBufferSize]);

  useEffect(() => {
    const { from, to } = getFullRange(rangeRef.current, renderBufferSize);
    dataSource.subscribe(
      {
        range: { from, to },
      },
      datasourceMessageHandler
    );
  }, [dataSource, datasourceMessageHandler, renderBufferSize]);

  useEffect(
    () => () => {
      dataSource.unsubscribe();
    },
    [dataSource]
  );

  return [
    data.current,
    dataWindow.rowCount,
    getFullRange(rangeRef.current, renderBufferSize),
    setRange,
  ];
}

export class MovingWindow {
  public data: DataSourceRow[];
  public rowCount = 0;
  private range: WindowRange;

  constructor({ from, to }: VuuRange) {
    this.range = new WindowRange(from, to);
    this.data = new Array(to - from);
  }

  setRowCount = (rowCount: number) => {
    if (rowCount < this.data.length) {
      this.data.length = rowCount;
    }
    this.rowCount = rowCount;
  };

  add(data: DataSourceRow) {
    const [index] = data;
    if (this.isWithinRange(index)) {
      const internalIndex = index - this.range.from;
      this.data[internalIndex] = data;
      if (this.data[internalIndex - 1]) {
        // assign 'post-selected' selection state
        if (
          this.data[internalIndex - 1][SELECTED] === 1 &&
          data[SELECTED] === 0
        ) {
          data[SELECTED] = 2;
        }
      }
      if (index === this.rowCount - 1) {
        this.data.length = internalIndex + 1;
      }
    }
  }

  getAtIndex(index: number) {
    return this.range.isWithin(index) &&
      this.data[index - this.range.from] != null
      ? this.data[index - this.range.from]
      : undefined;
  }

  isWithinRange(index: number) {
    return this.range.isWithin(index);
  }

  setRange(from: number, to: number) {
    if (from !== this.range.from || to !== this.range.to) {
      const [overlapFrom, overlapTo] = this.range.overlap(from, to);
      const newData = new Array(to - from);
      for (let i = overlapFrom; i < overlapTo; i++) {
        const data = this.getAtIndex(i);
        if (data) {
          const index = i - from;
          newData[index] = data;
        }
      }
      this.data = newData;
      this.range.from = from;
      this.range.to = to;
    }
  }
}
