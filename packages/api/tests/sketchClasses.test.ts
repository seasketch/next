import { DatabaseTransactionConnectionType, sql } from "slonik";
import { createPool } from "./pool";
import {
  createUser,
  createProject,
  addParticipant,
  createSession,
  clearSession,
  createGroup,
  addGroupToAcl,
  projectTransaction,
} from "./helpers";

const pool = createPool("test");

describe("Access Control", () => {
  test("Only admins can create or edit sketch classes", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const regularGuy = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      await createSession(conn, adminId, true, false, projectId);
      const sketchClass = await conn.one(
        sql`insert into sketch_classes (project_id, name) values (${projectId}, 'MPA') returning *`
      );
      expect(sketchClass.name).toBe("MPA");
      await createSession(conn, regularGuy, true, false, projectId);
      expect(
        conn.any(
          sql`insert into sketch_classes (project_id, name) values (${projectId}, 'MPA-eyy!') returning *`
        )
      ).rejects.toThrow();
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("Only users with project access can see all sketch classes", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const regularGuy = await createUser(conn);
      const approvedParticipant = await createUser(conn);
      const projectId = await createProject(conn, adminId, "invite_only");
      await addParticipant(
        conn,
        approvedParticipant,
        projectId,
        false,
        true,
        true
      );
      await createSession(conn, adminId, true, false, projectId);
      const sketchClass = await conn.one(
        sql`insert into sketch_classes (project_id, name) values (${projectId}, 'MPA') returning *`
      );
      expect(sketchClass.name).toBe("MPA");
      await createSession(conn, approvedParticipant, true, false, projectId);
      expect(
        await conn.oneFirst(
          sql`select count(*) from sketch_classes where project_id = ${projectId}`
        )
      ).toBe(1);
      await createSession(conn, regularGuy, true, false, projectId);
      expect(
        await conn.oneFirst(
          sql`select count(*) from sketch_classes where project_id = ${projectId}`
        )
      ).toBe(0);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("canDigitize indicates who can digitize new sketches", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const participantB = await createUser(conn);
      const approvedParticipant = await createUser(conn);
      const projectId = await createProject(conn, adminId, "invite_only");
      await addParticipant(
        conn,
        approvedParticipant,
        projectId,
        false,
        true,
        true
      );
      await addParticipant(conn, participantB, projectId, false, true, true);
      await createSession(conn, adminId, true, false, projectId);
      const groupId = await createGroup(conn, projectId, "Group A", [
        approvedParticipant,
      ]);
      const sketchClass = await conn.one(
        sql`insert into sketch_classes (project_id, name) values (${projectId}, 'MPA') returning *`
      );
      await clearSession(conn);
      const aclId = await conn.oneFirst(
        sql`select id from access_control_lists where sketch_class_id = ${sketchClass.id}`
      );
      await createSession(conn, adminId, true, false, projectId);
      await conn.any(
        sql`update access_control_lists set type = 'group' where id = ${aclId}`
      );
      await addGroupToAcl(conn, aclId as number, groupId);
      await createSession(conn, approvedParticipant, true, false, projectId);
      expect(
        await conn.oneFirst(
          sql`select sketch_classes_can_digitize(sketch_classes.*) from sketch_classes where id = ${sketchClass.id}`
        )
      ).toBe(true);
      await createSession(conn, participantB, true, false, projectId);
      expect(
        await conn.oneFirst(
          sql`select sketch_classes_can_digitize(sketch_classes.*) from sketch_classes where id = ${sketchClass.id}`
        )
      ).toBe(false);
      await conn.any(sql`ROLLBACK`);
    });
  });
});

test("Cannot change project_id", async () => {
  await pool.transaction(async (conn) => {
    const adminId = await createUser(conn);
    const projectId = await createProject(conn, adminId, "invite_only");
    const projectBId = await createProject(conn, adminId, "public");
    await createSession(conn, adminId, true, false, projectId);
    const sketchClass = await conn.one(
      sql`insert into sketch_classes (project_id, name) values (${projectId}, 'MPA') returning *`
    );
    expect(sketchClass.name).toBe("MPA");
    expect(
      conn.any(
        sql`update sketch_classes set project_id = ${projectBId} where id = ${sketchClass.id}`
      )
    ).rejects.toThrow();
    await conn.any(sql`ROLLBACK`);
  });
});

describe("Collections - valid children", () => {
  test("addValidChildSketchClass can be used by admins (and only admins)", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const regularJoe = await createUser(conn);
      const projectId = await createProject(conn, adminId, "invite_only");
      await createSession(conn, adminId, true, false, projectId);
      const collectionId = await conn.oneFirst(
        sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'Collection', 'COLLECTION') returning id`
      );
      const mpaId = await conn.oneFirst(
        sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'MPA', 'POLYGON') returning id`
      );
      await conn.any(
        sql`select add_valid_child_sketch_class(${collectionId}, ${mpaId})`
      );
      await createSession(conn, regularJoe, true, false, projectId);
      expect(
        conn.any(
          sql`select add_valid_child_sketch_class(${collectionId}, ${mpaId})`
        )
      ).rejects.toThrow(/admin/);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("addValidChildSketchClass - don't allow duplicate records", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "invite_only");
      await createSession(conn, adminId, true, false, projectId);
      const collectionId = await conn.oneFirst(
        sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'Collection', 'COLLECTION') returning id`
      );
      const mpaId = await conn.oneFirst(
        sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'MPA', 'POLYGON') returning id`
      );
      await conn.any(
        sql`select add_valid_child_sketch_class(${collectionId}, ${mpaId})`
      );
      expect(
        conn.any(
          sql`select add_valid_child_sketch_class(${collectionId}, ${mpaId})`
        )
      ).rejects.toThrow(/constraint/);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("removeValidChildSketchClass", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "invite_only");
      await createSession(conn, adminId, true, false, projectId);
      const collectionId = await conn.oneFirst(
        sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'Collection', 'COLLECTION') returning id`
      );
      const mpaId = await conn.oneFirst(
        sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'MPA', 'POLYGON') returning id`
      );
      await conn.any(
        sql`select add_valid_child_sketch_class(${collectionId}, ${mpaId})`
      );
      await conn.any(
        sql`select remove_valid_child_sketch_class(${collectionId}, ${mpaId})`
      );
      await clearSession(conn);
      expect(
        await conn.oneFirst(
          sql`select count(*) from sketch_classes_valid_children where parent_id = ${collectionId}`
        )
      ).toBe(0);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("validChildren property", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "invite_only");
      await createSession(conn, adminId, true, false, projectId);
      const collectionId = await conn.oneFirst(
        sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'Collection', 'COLLECTION') returning id`
      );
      const mpaId = await conn.oneFirst(
        sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'MPA', 'POLYGON') returning id`
      );
      const notValidChildId = await conn.oneFirst(
        sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'Not Valid Child', 'POLYGON') returning id`
      );
      await conn.any(
        sql`select add_valid_child_sketch_class(${collectionId}, ${mpaId})`
      );
      const validChildren = await conn.any(
        sql`select sketch_classes_valid_children(sketch_classes.*) from sketch_classes where id = ${collectionId}`
      );
      expect(validChildren.length).toBe(1);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("Can't give validChildren to non-collections", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "invite_only");
      await createSession(conn, adminId, true, false, projectId);
      const collectionId = await conn.oneFirst(
        sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'Collection', 'COLLECTION') returning id`
      );
      const mpaId = await conn.oneFirst(
        sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'MPA', 'POLYGON') returning id`
      );
      expect(
        conn.any(
          sql`select add_valid_child_sketch_class(${mpaId}, ${collectionId})`
        )
      ).rejects.toThrow(/children/);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("parent & child must be from the same project", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "invite_only");
      const projectBId = await createProject(conn, adminId, "invite_only");
      await createSession(conn, adminId, true, false, projectId);
      const collectionId = await conn.oneFirst(
        sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectBId}, 'Collection', 'COLLECTION') returning id`
      );
      const mpaId = await conn.oneFirst(
        sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'MPA', 'POLYGON') returning id`
      );
      expect(
        conn.any(
          sql`select add_valid_child_sketch_class(${collectionId}, ${mpaId})`
        )
      ).rejects.toThrow(/project/);
      await conn.any(sql`ROLLBACK`);
    });
  });
});

test("sketchCount indicates how many sketches have been created", async function () {
  await pool.transaction(async (conn) => {
    const adminId = await createUser(conn);
    const projectId = await createProject(conn, adminId);
    await createSession(conn, adminId, true, false, projectId);
    const sketchClassId = await conn.oneFirst(
      sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'Collection', 'COLLECTION') returning id`
    );
    let count = 11;
    while (count--) {
      await conn.any(
        sql`insert into sketches (user_id, sketch_class_id, name) values (${adminId}, ${sketchClassId}, ${`sketch name ${count}`})`
      );
    }
    expect(
      await conn.oneFirst(
        sql`select sketch_classes_sketch_count(sketch_classes.*) from sketch_classes where id = ${sketchClassId}`
      )
    ).toBe(11);
    await conn.any(sql`ROLLBACK`);
  });
});

test("Cannot delete SketchClasses with more that 10 sketches", async () => {
  await pool.transaction(async (conn) => {
    const adminId = await createUser(conn);
    const projectId = await createProject(conn, adminId);
    await createSession(conn, adminId, true, false, projectId);
    const sketchClassId = await conn.oneFirst(
      sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'Collection', 'COLLECTION') returning id`
    );
    let count = 11;
    while (count--) {
      await conn.any(
        sql`insert into sketches (user_id, sketch_class_id, name) values (${adminId}, ${sketchClassId}, ${`sketch name ${count}`})`
      );
    }
    expect(
      conn.any(sql`delete from sketch_classes where id = ${sketchClassId}`)
    ).rejects.toThrow(/sketches/);
    await conn.any(sql`ROLLBACK`);
  });
});

async function createForm(
  callback: (
    conn: DatabaseTransactionConnectionType,
    formId: number,
    surveyId: number,
    projectId: number,
    adminId: number,
    userIds: [number, number]
  ) => Promise<void>
) {
  await projectTransaction(
    pool,
    "public",
    async (conn, projectId, adminId, userIds) => {
      await createSession(conn, adminId, true, false, projectId);
      const surveyId = await conn.oneFirst<number>(
        sql`select id from make_survey('Survey A', ${projectId}, null)`
      );
      const formId = await conn.oneFirst<number>(
        sql`select id from forms where survey_id = ${surveyId}`
      );
      await clearSession(conn);
      await callback(conn, formId, surveyId, projectId, adminId, userIds);
    }
  );
}

describe("Sketch Classes tied to FormElements", () => {
  test("spatial form elements are initialized with a sketch class copied from sketch_class_template_id", async () => {
    await createForm(
      async (conn, formId, surveyId, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const elementId = await conn.oneFirst<number>(
          sql`insert into form_elements (form_id, type_id, body) values (${formId}, 'MultiSpatialInput', '{}'::jsonb) returning id`
        );
        const sketchClass = await conn.one<{
          allow_multi: boolean;
          geometry_type: string;
          form_element_id: number;
          id: number;
        }>(
          sql`select * from sketch_classes where form_element_id = ${elementId}`
        );
        expect(sketchClass.allow_multi).toBe(false);
        expect(sketchClass.geometry_type).toBe("POLYGON");
        // TODO: ensure form is copied as well
        const form = await conn.one<{
          id: number;
          is_template: boolean;
        }>(sql`select * from forms where sketch_class_id = ${sketchClass.id}`);
        expect(form.is_template).toBe(false);
        const formElements = await conn.any<{ id: number }>(
          sql`select * from form_elements where form_id = ${form.id}`
        );
        expect(formElements.length).toBeGreaterThan(0);
      }
    );
  });
  test("sketch classes associated with a form element cannot be deleted", async () => {
    await createForm(
      async (conn, formId, surveyId, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const elementId = await conn.oneFirst<number>(
          sql`insert into form_elements (form_id, type_id, body) values (${formId}, 'MultiSpatialInput', '{}'::jsonb) returning id`
        );
        const sketchClass = await conn.one<{
          allow_multi: boolean;
          geometry_type: string;
          form_element_id: number;
          id: number;
        }>(
          sql`select * from sketch_classes where form_element_id = ${elementId}`
        );
        expect(sketchClass.allow_multi).toBe(false);
        expect(sketchClass.geometry_type).toBe("POLYGON");
        expect(
          conn.any(sql`delete from sketch_classes where id = ${sketchClass.id}`)
        ).rejects.toThrow(/form element/i);
      }
    );
  });
  test("survey sketch classes are deleted along with parent form element", async () => {
    await createForm(
      async (conn, formId, surveyId, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const elementId = await conn.oneFirst<number>(
          sql`insert into form_elements (form_id, type_id, body) values (${formId}, 'MultiSpatialInput', '{}'::jsonb) returning id`
        );
        const sketchClass = await conn.one<{
          allow_multi: boolean;
          geometry_type: string;
          form_element_id: number;
          id: number;
        }>(
          sql`select * from sketch_classes where form_element_id = ${elementId}`
        );
        expect(sketchClass.allow_multi).toBe(false);
        expect(sketchClass.geometry_type).toBe("POLYGON");
        const form = await conn.one<{
          id: number;
          is_template: boolean;
        }>(sql`select * from forms where sketch_class_id = ${sketchClass.id}`);
        await conn.any(sql`delete from form_elements where id = ${elementId}`);
        expect(
          conn.one(
            sql`select * from sketch_classes where id = ${sketchClass.id}`
          )
        ).rejects.toThrow(/not found/i);
        expect(
          conn.one(sql`select * from forms where id = ${form.id}`)
        ).rejects.toThrow(/not found/i);
      }
    );
  });
});

test("Don't allow geometry type to be changed for sketch classes that aren't a part of surveys", async () => {
  await pool.transaction(async (conn) => {
    const adminId = await createUser(conn);
    const projectId = await createProject(conn, adminId, "invite_only");
    const projectBId = await createProject(conn, adminId, "public");
    await createSession(conn, adminId, true, false, projectId);
    const sketchClass = await conn.one(
      sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'MPA', 'POLYGON') returning *`
    );
    expect(sketchClass.name).toBe("MPA");
    expect(
      conn.any(
        sql`update sketch_classes set geometry_type = 'POINT' where id = ${sketchClass.id}`
      )
    ).rejects.toThrow();
    await conn.any(sql`ROLLBACK`);
  });
});
