import type { NextFunction, Request, Response, Router } from "express";

import { AppError } from "@/common/http/app-error";

type RouterStackLayer = {
  name?: string;
  route?: { path?: unknown; methods?: Record<string, boolean> };
  handle?: unknown;
};

type Routable = {
  stack?: RouterStackLayer[];
};

const getStack = (router: Router): RouterStackLayer[] =>
  ((router as Router & Routable).stack ?? []) as RouterStackLayer[];

const isRouterHandle = (handle: unknown): handle is Router => {
  if (typeof handle !== "function") {
    return false;
  }
  return Array.isArray((handle as Routable).stack);
};

/**
 * Collects all defined route paths from a router stack. Because Express 5 does
 * not reliably expose mount paths on middleware layers, this collects leaf
 * route paths relative to their immediate router. For 405 detection we use
 * these at the sub-router level where paths are known.
 */
const collectSubRouterPaths = (stack: RouterStackLayer[]): Set<string> => {
  const paths = new Set<string>();
  for (const layer of stack) {
    const routePath = layer.route?.path;
    if (typeof routePath === "string") {
      paths.add(routePath.replace(/\/+$/, "") || "/");
    }
  }
  return paths;
};

/**
 * Attaches a trailing wildcard handler to each sub-router that checks whether
 * the requested path matches any defined route in that sub-router. If it does
 * but the method is not allowed, emits a 405. Otherwise passes through to
 * the parent router's notFoundHandler.
 *
 * Uses Express 5 compatible "{*path}" wildcard syntax instead of "*".
 */
export const attachMethodNotAllowedHandlers = (router: Router): void => {
  for (const layer of getStack(router)) {
    if (layer.name !== "router" || !isRouterHandle(layer.handle)) {
      continue;
    }

    const subRouter = layer.handle as Router & { _has405Handler?: boolean };

    if (!subRouter._has405Handler) {
      const knownPaths = collectSubRouterPaths(getStack(subRouter));

      subRouter.all(
        "/{*path}",
        (req: Request, _res: Response, next: NextFunction) => {
          const reqPath = req.path.replace(/\/+$/, "") || "/";
          if (knownPaths.has(reqPath)) {
            next(
              new AppError(
                405,
                `Method ${req.method} not allowed for ${req.path}`,
              ),
            );
          } else {
            next();
          }
        },
      );
      subRouter._has405Handler = true;
    }

    // Recurse into deeply nested routers
    attachMethodNotAllowedHandlers(subRouter);
  }
};

/**
 * Middleware factory that attaches 405 handlers to sub-routers and returns
 * a top-level fallback for root-level routes.
 */
export const methodNotAllowedHandler = (router: Router) => {
  attachMethodNotAllowedHandlers(router);

  return (request: Request, _response: Response, next: NextFunction): void => {
    const topRoutes = getStack(router).filter(
      (layer) => layer.route !== undefined,
    );
    const reqPath = request.path.replace(/\/+$/, "") || "/";
    const method = request.method.toUpperCase();

    const matched = topRoutes.some((layer) => {
      const routePath = layer.route?.path;
      const rp =
        typeof routePath === "string"
          ? routePath.replace(/\/+$/, "") || "/"
          : "";
      const allowedMethods = Object.keys(layer.route?.methods ?? {}).map((m) =>
        m.toUpperCase(),
      );
      return rp === reqPath && !allowedMethods.includes(method);
    });

    if (matched) {
      next(
        new AppError(
          405,
          `Method ${method} not allowed for ${request.path}`,
        ),
      );
      return;
    }

    next();
  };
};

export const notFoundHandler = (
  request: Request,
  _response: Response,
  next: NextFunction,
): void => {
  const pathOnly = request.originalUrl.split("?")[0] ?? request.originalUrl;
  next(
    new AppError(
      404,
      `Route not found: ${request.method} ${pathOnly}`,
      undefined,
      "NOT_FOUND",
    ),
  );
};
