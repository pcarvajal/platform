import { NotFoundError } from "./HttpError.js";
import { HttpMethod } from "./HttpMethod.js";
import { HttpRequest } from "./HttpRequest.js";
import { HttpResponse } from "./HttpResponse.js";
import { HttpRoute } from "./HttpRoute.js";

type PathParams = Record<string, string | undefined>;

export class HttpRouter {
  constructor(private readonly routes: HttpRoute[]) {}

  dispatch = (request: HttpRequest): Promise<HttpResponse> => {
    const match = this.match(request.method, request.path);
    if (!match) {
      throw new NotFoundError(`No route for ${request.method} ${request.path}`);
    }

    const { route, pathParams } = match;
    return route.handle({
      ...request,
      pathParams: { ...request.pathParams, ...pathParams },
    });
  };

  describe(): string[] {
    return this.routes.map((route) => `${route.method} ${route.path}`);
  }

  private match(
    method: HttpMethod,
    path: string,
  ): { route: HttpRoute; pathParams: PathParams } | undefined {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const pathParams = this.matchPath(route.path, path);
      if (pathParams) return { route, pathParams };
    }
    return undefined;
  }

  private matchPath(template: string, path: string): PathParams | undefined {
    const templateSegments = template.split("/");
    const pathSegments = path.split("/");
    if (templateSegments.length !== pathSegments.length) return undefined;

    const params: PathParams = {};
    for (let i = 0; i < templateSegments.length; i++) {
      const templateSegment = templateSegments[i];
      const pathSegment = pathSegments[i];
      if (templateSegment?.startsWith(":")) {
        params[templateSegment.slice(1)] = pathSegment;
      } else if (templateSegment !== pathSegment) {
        return undefined;
      }
    }
    return params;
  }
}
