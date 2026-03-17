import React, { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import AdminMenu from "../../components/AdminMenu";
import axios from "axios";
import toast from "react-hot-toast";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get("/api/v1/auth/users");
      if (data?.success) setUsers(data.users || []);
      else toast.error(data?.message || "Failed to load users");
    } catch (err) {
      console.log(err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <Layout title={"Dashboard - All Users"}>
      <div className="container-fluid px-3 py-3 my-3">
        <div className="row">
          <div className="col-md-3">
            <AdminMenu />
          </div>

          <div className="col-md-9">
            <h1>All Users</h1>

            {loading ? (
              <p>Loading...</p>
            ) : users.length === 0 ? (
              <p>No users found.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Phone</th>
                      <th>Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u._id}>
                        <td>{i + 1}</td>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>{u.role === 1 ? "Admin" : "User"}</td>
                        <td>{u.phone || "-"}</td>
                        <td>{u.address || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Users;