import {
  GraphSeriesValue,
  Field,
  formattedValueToString,
  getDisplayProcessor,
  TimeZone,
  dateTimeFormat,
} from '@grafana/data';

/**
 * Returns index of the closest datapoint BEFORE hover position
 *
 * @param posX
 * @param series
 */
export const findHoverIndexFromData = (xAxisDimension: Field, xPos: number) => {
  let lower = 0;
  let upper = xAxisDimension.values.length - 1;
  let middle;

  while (true) {
    if (lower > upper) {
      return Math.max(upper, 0);
    }
    middle = Math.floor((lower + upper) / 2);
    const xPosition = xAxisDimension.values.get(middle);

    if (xPosition === xPos) {
      return middle;
    } else if (xPosition && xPosition < xPos) {
      lower = middle + 1;
    } else {
      upper = middle - 1;
    }
  }
};

interface MultiSeriesHoverInfo {
  value: string;
  time: string;
  datapointIndex: number;
  seriesIndex: number;
  label?: string;
  color?: string;
}

/**
 * Returns information about closest datapoints when hovering over a Graph
 *
 * @param seriesList list of series visible on the Graph
 * @param pos mouse cursor position, based on jQuery.flot position
 */
export const getMultiSeriesGraphHoverInfo = (
  // x and y axis dimensions order is aligned
  yAxisDimensions: Field[],
  xAxisDimensions: Field[],
  /** Well, time basically */
  xAxisPosition: number,
  timeZone?: TimeZone
): {
  results: MultiSeriesHoverInfo[];
  time?: GraphSeriesValue;
} => {
  let i, field, hoverIndex, hoverDistance, pointTime;

  const results: MultiSeriesHoverInfo[] = [];

  let minDistance, minTime;

  for (i = 0; i < yAxisDimensions.length; i++) {
    field = yAxisDimensions[i];
    const time = xAxisDimensions[i];
    hoverIndex = findHoverIndexFromData(time, xAxisPosition);
    hoverDistance = xAxisPosition - time.values.get(hoverIndex);
    pointTime = time.values.get(hoverIndex);
    // Take the closest point before the cursor, or if it does not exist, the closest after
    if (
      minDistance === undefined ||
      (hoverDistance >= 0 && (hoverDistance < minDistance || minDistance < 0)) ||
      (hoverDistance < 0 && hoverDistance > minDistance)
    ) {
      minDistance = hoverDistance;
      minTime = time.display ? formattedValueToString(time.display(pointTime)) : pointTime;
    }

    const display = field.display ?? getDisplayProcessor({ field, timeZone });
    const disp = display(field.values.get(hoverIndex));

    results.push({
      value: formattedValueToString(disp),
      datapointIndex: hoverIndex,
      seriesIndex: i,
      color: disp.color,
      label: field.name,
      time: time.display ? formattedValueToString(time.display(pointTime)) : pointTime,
    });
  }

  return {
    results,
    time: minTime,
  };
};

export const graphTickFormatter = (epoch: number, axis: any) => {
  return dateTimeFormat(epoch, {
    format: axis?.options?.timeformat,
    timeZone: axis?.options?.timezone,
  });
};

export const graphTimeFormat = (ticks: number | null, min: number | null, max: number | null): string => {
  if (min && max && ticks) {
    const range = max - min;
    const secPerTick = range / ticks / 1000;
    // Need have 10 millisecond margin on the day range
    // As sometimes last 24 hour dashboard evaluates to more than 86400000
    const oneDay = 86400010;
    const oneYear = 31536000000;

    if (secPerTick <= 45) {
      return localTimeFormat({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }, 'HH:mm:ss');
    }
    if (secPerTick <= 7200 || range <= oneDay) {
      return localTimeFormat({ hour: '2-digit', minute: '2-digit', hour12: false }, 'HH:mm');
    }
    if (secPerTick <= 80000) {
      return localTimeFormat(
        { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false },
        'MM/DD HH:mm'
      );
    }
    if (secPerTick <= 2419200 || range <= oneYear) {
      return localTimeFormat({ month: '2-digit', day: '2-digit', hour12: false }, 'MM/DD');
    }
    return localTimeFormat({ year: 'numeric', month: '2-digit', hour12: false }, 'YYYY-MM');
  }

  return localTimeFormat({ hour: '2-digit', minute: '2-digit', hour12: false }, 'HH:mm');
};

const localTimeFormat = (options: Intl.DateTimeFormatOptions, fallback: string): string => {
  if (!window.Intl) {
    return fallback;
  }

  // https://momentjs.com/docs/#/displaying/format/
  const parts = new Intl.DateTimeFormat('default', options).formatToParts(new Date());
  const mapping: { [key: string]: string } = {
    year: 'YYYY',
    month: 'MM',
    day: 'DD',
    hour: 'HH',
    minute: 'mm',
    second: 'ss',
    weekday: 'ddd',
    era: 'N',
    dayPeriod: 'A',
    timeZoneName: 'Z',
  };

  return parts.map(part => mapping[part.type] || part.value).join('');
};
