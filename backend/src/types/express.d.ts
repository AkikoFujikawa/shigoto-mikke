declare global {
  namespace Express {
    interface Request {
      student?: {
        id: number;
        schoolId: number;
      };
    }
  }
}

export {};
