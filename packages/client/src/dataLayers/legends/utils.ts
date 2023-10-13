import { Expression } from "mapbox-gl";

export function isExpression(e: any): e is Expression {
  return Array.isArray(e) && typeof e[0] === "string";
}

/**
 * Converts a set of stops to a css linear-gradient
 * @param stops { color: string; value: number}
 */
export function stopsToLinearGradient(
  stops: { color: string; value: number }[]
): string {
  const sortedStops = [...stops].sort((a, b) => a.value - b.value);
  const colors = sortedStops.map((stop) => stop.color);
  const values = sortedStops.map((stop) => stop.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const percentages = values.map((val) => (val - min) / (max - min));
  const stopStrings = colors.map(
    (color, i) => `${color} ${percentages[i] * 100}%`
  );
  // eslint-disable-next-line i18next/no-literal-string
  return `linear-gradient(90deg, ${stopStrings.join(", ")})`;
}

export function pluckGetExpressionsOfType(
  expression: any,
  type: string | RegExp,
  options?: {
    targetExpressionMustIncludeGet?: boolean;
  }
) {
  let remainingValues: any = expression;
  const expressions: { expression: Expression; filters: Expression[] }[] = [];
  function matchesType(fnName: string) {
    return typeof type === "string" ? fnName === type : type.test(fnName);
  }
  if (isExpression(expression)) {
    const fnName = expression[0];
    if (matchesType(fnName) && hasGetExpression(expression)) {
      expressions.push({ expression, filters: [] });
      remainingValues = null;
    } else {
      // If a case or match expression, add any matching expressions but append
      // a filter. In theory these expressions could be deeply nested but I'm
      // not going to support such pathological cases unless an important
      // use-case is identified.
      if (fnName === "case") {
        const newExpression: Expression = ["case"];
        const args = expression.slice(1);
        const conditionsAndOutputs = args.slice(0, args.length - 1);
        for (var i = 0; i < conditionsAndOutputs.length; i += 2) {
          const condition = conditionsAndOutputs[i];
          const output = conditionsAndOutputs[i + 1];
          if (
            isExpression(output) &&
            matchesType(output[0]) &&
            (hasGetExpression(output) ||
              options?.targetExpressionMustIncludeGet === false)
          ) {
            expressions.push({
              expression: output,
              filters: [condition],
            });
          } else {
            newExpression.push(condition, output);
          }
        }
        let fallback = args[args.length - 1];
        if (
          isExpression(fallback) &&
          matchesType(fallback[0]) &&
          (hasGetExpression(fallback) ||
            options?.targetExpressionMustIncludeGet === false)
        ) {
          // fallback is added without any filters. I'm not sure if that's right
          // TODO: it may be better to add the "inverse" of previous conditions
          expressions.push({ expression: fallback, filters: [] });
          fallback = null;
          if (newExpression.length > 1) {
            // nullify fallback so that fallback isn't represented in later
            // panels
            newExpression.push(null);
          }
        } else {
          if (newExpression.length > 1) {
            newExpression.push(fallback);
            fallback = null;
          }
        }
        if (newExpression.length > 2) {
          remainingValues = newExpression;
        } else {
          if (fallback) {
            remainingValues = fallback;
          } else {
            remainingValues = null;
          }
        }
      } else if (fnName === "match") {
        const newExpression: Expression = ["match"];
        const args = expression.slice(1);
        const input = args[0];
        const inputIsGetExpression = isExpression(input) && input[0] === "get";
        newExpression.push(input);
        const fallback = args[args.length - 1];
        const matchAndOutputs = args.slice(1, args.length - 1);
        for (var i = 0; i < matchAndOutputs.length; i += 2) {
          const match = matchAndOutputs[i];
          const output = matchAndOutputs[i + 1];
          if (
            isExpression(output) &&
            matchesType(output[0]) &&
            hasGetExpression(output)
          ) {
            expressions.push({
              expression: output,
              filters: inputIsGetExpression ? [["==", input, match]] : [],
            });
          } else {
            newExpression.push(match, output);
          }
        }
        let newExpressionIsEmpty = newExpression.length === 2;
        if (
          isExpression(fallback) &&
          matchesType(fallback[0]) &&
          hasGetExpression(fallback)
        ) {
          // fallback is added without any filters. I'm not sure if that's right
          expressions.push({ expression: fallback, filters: [] });
          if (!newExpressionIsEmpty) {
            // nullify fallback so that fallback isn't represented in later
            // panels
            newExpression.push(null);
            remainingValues = newExpression;
          } else {
            remainingValues = null;
          }
        } else {
          if (newExpressionIsEmpty) {
            remainingValues = fallback;
          } else {
            newExpression.push(fallback);
            remainingValues = newExpression;
          }
        }
      }
    }
  }
  return { facets: expressions, remainingValues };
}

export function hasGetExpression(expression: any, isFilter?: boolean): boolean {
  const get = findGetExpression(expression, isFilter);
  return get ? true : false;
}

export function findGetExpression(
  expression: any,
  isFilter?: boolean,
  parent?: Expression
): null | { type: "legacy" | "get"; property: string } {
  if (!isExpression(expression)) {
    return null;
  }
  if (isFilter && !parent) {
    // check for legacy filter type
    if (
      typeof expression[1] === "string" &&
      !/\$/.test(expression[1]) &&
      expression[1] !== "zoom"
    ) {
      return {
        type: "legacy",
        property: expression[1],
      };
    }
  }
  if (expression[0] === "get") {
    return { type: "get", property: expression[1] };
  } else {
    for (const arg of expression.slice(1)) {
      if (isExpression(arg)) {
        const found = findGetExpression(arg, isFilter, expression);
        if (found !== null) {
          return found;
        }
      }
    }
  }
  return null;
}

export function hasGetExpressionForProperty(expression: any, property: string) {
  if (isExpression(expression)) {
    if (expression[0] === "get" && expression[1] === property) {
      return true;
    } else {
      for (const arg of expression.slice(1)) {
        if (hasGetExpressionForProperty(arg, property)) {
          return true;
        }
      }
    }
  }
  return false;
}
