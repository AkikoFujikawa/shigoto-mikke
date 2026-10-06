declare global {
  namespace Express {
    interface Request {
      student?: {
        id: number;
        schoolId: number;
      };
      admin?: {
        role: "school_admin";
        id: number;
        schoolId: number;
      };
    }
  }
}

export {};
