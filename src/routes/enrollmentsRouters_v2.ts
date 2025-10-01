import { Router, type Request, type Response } from "express";

//
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

//import type
import type {
  User,
  Student,
  UserPayload,
  CustomRequest,
  Enrollment,
} from "../libs/types.js";

// import database
import { users, reset_users } from "../db/db.js";
import { students } from "../db/db.js";
import { courses } from "../db/db.js";
import { enrollments, reset_enrollments } from "../db/db.js";

import { success } from "zod";
import { error } from "console";
import { authenticateToken } from "../middlewares/authenticMiddleware.js";
import { checkRoleAdmin } from "../middlewares/checkRoleAdminMiddleware.js"; 
import { checkRoleStudent } from "../middlewares/checkRoleStudentMiddleware.js"; 
import { checkRoles } from "../middlewares/checkRolesMiddleware.js"; 
import { zStudentId } from "../libs/zodValidators.js";
import { zEnrollmentBody } from "../libs/zodValidators.js";

const router = Router();

//GET   /api/v2/enrollments
router.get(
  "/",
  authenticateToken,
  checkRoleAdmin,
  (req: CustomRequest, res: Response) => {
    try {
      const user_id = students.map((s: Student) => {
        const students_Enrollments = enrollments
          .filter((ent: Enrollment) => ent.studentId === s.studentId)
          .map((ent: Enrollment) => ({ courseId: ent.courseId }));

        return {
          studentId: s.studentId,
          courses: students_Enrollments,
        };
      });

      return res.status(200).json({
        success: true,
        message: "Enrollments Information",
        data: user_id,
      });
    } catch (err) {
      return res.status(200).json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  }
);


// POST /api/v2/enrollments/reset
router.post("/reset", (req: Request, res: Response) => {
  try {
    reset_enrollments();
    return res.status(200).json({
      success: true,
      message: "enrollments database has been reset",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Something is wrong, please try again",
      error: err,
    });
  }
});

// GET  /api/v2/enrollments/:studentId
router.get(
  "/:studentId",
  authenticateToken,
  checkRoles,
  (req: CustomRequest, res: Response) => {
    try {
      const studentId = req.params.studentId;
      const user = req.user;
      const result = zStudentId.safeParse(studentId);

      const foundIndex = students.findIndex(
        (s: Student) => s.studentId === studentId
      );

      const student = students.find(
        (sd: Student) => sd.studentId === studentId
      );

      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: result.error.issues[0]?.message,
        });
      }

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student does not exist",
        });
      }

      if (user?.role === "STUDENT" && user.studentId !== studentId) {
        return res.status(403).json({
          success: false,
          massage: "Forbidden access",
        });
      }

      res.status(200).json({
        success: true,
        data: students[foundIndex],
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  }
);

// POST /api/v2/enrollments/:studentID
router.post(
  "/:studentId",
  authenticateToken,
  checkRoles,
  (req: CustomRequest, res: Response) => {
    try {
      const { studentId } = req.params;
      const { courseId } = req.body as { courseId: string };
      const payload = req.user;


      if (payload?.role === "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Forbidden access",
        });
      }

      const student = students.find((s: Student) => s.studentId === studentId);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: `Student ${studentId} not found`,
        });
      }

      if (payload?.role === "STUDENT" && payload.studentId !== studentId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden access",
        });
      }

      if (!student.courses) student.courses = [];

      if (student.courses.includes(courseId)) {
        return res.status(409).json({
          success: false,
          message: "studentId && courseId is already exists",
        });
      }

      student.courses.push(courseId);

      return res.status(201).json({
        success: true,
        message: `studentId && courseId has been added successfully`,
        data: {
          studentId: student.studentId,
          courseId: courseId,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Something went wrong, please try again",
        error: err instanceof Error ? err.message : err,
      });
    }
  }
);

// DELETE /api/v2/enrollments/:studentID
router.delete(
  "/:studentId",
  authenticateToken,
  (req: CustomRequest, res: Response) => {
    try {
      const { studentId: paramStudentId } = req.params;
      const { courseId } = req.body;
      const user = req.user;

      if (user?.role !== "STUDENT" || user.studentId !== paramStudentId) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to modify another student's data",
        });
      }

      const index = enrollments.findIndex(
        (enr) => enr.studentId === paramStudentId && enr.courseId === courseId
      );

      if (index === -1) {
        return res.status(404).json({
          success: false,
          message: "Enrollment does not exists",
        });
      }

      enrollments.splice(index, 1);

      return res.status(200).json({
        success: true,
        message: `Student ${paramStudentId} && Course ${courseId} has been deleted successfully`,
        data: enrollments.filter((enr) => enr.studentId === paramStudentId),
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Something went wrong, please try again",
        error: err,
      });
    }
  }
);

export default router;
