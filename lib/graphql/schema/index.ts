import { builder } from "./builder";

import "./types/scalars";
import "./types/enums";
import "./types/user";
import "./types/member";
import "./types/team";
import "./types/task";
import "./types/match";
import "./queries";
import "./mutations/tasks";

export const schema = builder.toSchema();
