declare global {
  namespace Express {
    interface Request {
      student?: {
        id: number;
        schoolId: number;
      };
      user?: {
        role: "school_admin";
        id: number;
        schoolId: number;
      };
    }
  }
}

export {};
