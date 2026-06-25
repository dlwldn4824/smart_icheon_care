export interface UserProfile {
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  employeeId: string;
  lastLogin: string;
}

export const currentUser: UserProfile = {
  name: "이현수",
  role: "주무관",
  department: "시설관리과",
  email: "ihs@icheon.go.kr",
  phone: "031-644-0000",
  employeeId: "IC-2018-042",
  lastLogin: "2026.06.24 08:32",
};
