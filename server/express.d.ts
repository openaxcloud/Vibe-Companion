import "express-serve-static-core";
import "express";

declare module "express-serve-static-core" {
  interface ParamsDictionary {
    [key: string]: string;
  }
  interface Request {
    params: ParamsDictionary;
    query: { [key: string]: string };
  }
}

declare module "express" {
  interface Request {
    params: Record<string, string>;
    query: Record<string, string>;
  }
}
